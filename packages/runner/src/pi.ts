import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Agent } from "./agent.js";
import { connectorPlanEnv, connectorToolNames, type ConnectorPlan } from "./connectors/index.js";
import type { Invocation } from "./invocation.js";
import { workspaceDir } from "./paths.js";
import type { RunLog } from "./run-log.js";
import { pushOutputFromPiEvent, pushTraceLine } from "./run-log.js";

export async function runPiInvocation(args: {
  invocation: Invocation;
  agent: Agent;
  log: RunLog;
  runId: string;
  model?: string;
  connectorPlan?: ConnectorPlan;
}): Promise<{ exitCode: number | null; signal: NodeJS.Signals | null; agentFile: string }> {
  const { invocation, agent, log, runId, model, connectorPlan } = args;
  if (!existsSync(agent.path)) throw new Error(`Agent not found: ${agent.path}`);

  const cwd = workspaceDir(invocation.workspaceKey);
  await mkdir(cwd, { recursive: true });
  const agentFile = await writeGeneratedAgentFile(cwd, runId, agent);

  // Pi's CLI calls this generated instruction file a "skill". AgentHQ keeps raw Pi
  // skill/context discovery disabled so scheduled/task runs are framed only by the
  // AgentHQ agent bundle plus explicitly enabled connectors.
  const piArgs = ["--mode", "json", "--no-session", "--no-skills", "--no-context-files", "--skill", agentFile];
  if (model) piArgs.push("--model", model);
  if (connectorPlan && connectorPlan.tools.length > 0) {
    piArgs.push("--extension", connectorExtensionPath());
  }
  piArgs.push(invocation.prompt);

  if (connectorPlan && connectorPlan.tools.length > 0) {
    pushTraceLine(log, {
      type: "agenthq_connector_plan",
      run_id: connectorPlan.runId,
      tools: connectorToolNames(connectorPlan),
      intents: connectorPlan.tools.map((tool) => tool.intent),
    });
  }

  pushTraceLine(log, {
    type: "agenthq_pi_start",
    command: "pi",
    args: piArgs.map((arg) => (arg === invocation.prompt ? "<prompt>" : arg)),
    cwd,
  });

  return await new Promise((resolve, reject) => {
    const child = spawn("pi", piArgs, {
      cwd,
      env: {
        ...process.env,
        AGENTHQ_RUN_ID: connectorPlan?.runId,
        AGENTHQ_CONNECTORS_CONFIG_JSON: connectorPlan && connectorPlan.tools.length > 0 ? connectorPlanEnv(connectorPlan) : undefined,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.on("error", reject);

    let stdoutBuffer = "";
    let stderrBuffer = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdoutBuffer += chunk;
      flushLines(stdoutBuffer, (line) => {
        stdoutBuffer = line.remaining;
        writePiLine(log, line.value);
      });
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderrBuffer += chunk;
      flushLines(stderrBuffer, (line) => {
        stderrBuffer = line.remaining;
        if (line.value.trim()) {
          log.errorLines.push(line.value);
          pushTraceLine(log, { type: "agenthq_stderr", text: line.value });
        }
      });
    });

    child.on("close", (exitCode, signal) => {
      if (stdoutBuffer.trim()) writePiLine(log, stdoutBuffer.trimEnd());
      if (stderrBuffer.trim()) {
        log.errorLines.push(stderrBuffer.trimEnd());
        pushTraceLine(log, { type: "agenthq_stderr", text: stderrBuffer.trimEnd() });
      }
      resolve({ exitCode, signal, agentFile });
    });
  });
}

async function writeGeneratedAgentFile(cwd: string, runId: string, agent: Agent): Promise<string> {
  const dir = path.join(cwd, ".agenthq");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${runId}-AGENT.md`);
  await writeFile(file, agent.instructions, "utf8");
  return file;
}

function connectorExtensionPath(): string {
  const compiled = fileURLToPath(new URL("./connectors/pi-extension.js", import.meta.url));
  if (existsSync(compiled)) return compiled;
  return fileURLToPath(new URL("./connectors/pi-extension.ts", import.meta.url));
}

function writePiLine(log: RunLog, line: string): void {
  const trimmed = line.endsWith("\r") ? line.slice(0, -1) : line;
  if (!trimmed) return;
  try {
    const parsed = JSON.parse(trimmed);
    pushTraceLine(log, trimmed);
    pushOutputFromPiEvent(log, parsed);
  } catch {
    pushTraceLine(log, { type: "agenthq_non_json_stdout", text: trimmed });
  }
}

function flushLines(
  buffer: string,
  onLine: (line: { value: string; remaining: string }) => void,
): void {
  while (true) {
    const index = buffer.indexOf("\n");
    if (index === -1) return;
    const value = buffer.slice(0, index);
    buffer = buffer.slice(index + 1);
    onLine({ value, remaining: buffer });
  }
}
