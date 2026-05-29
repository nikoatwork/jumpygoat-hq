import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { clampNumber, connectorSummary, errorMessage, truncateText } from "../helpers.js";
import type { ConnectorRuntimeConfig, ConnectorToolDefinition, ConnectorToolResult } from "../types.js";

type ScriptRunParams = { script: string; input?: unknown; maxOutputChars?: number };

type ScriptExecutionResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
  stdoutChars: number;
  stderrChars: number;
};

type ValidationResult = { requested: string; absolutePath: string; realScriptPath: string; realAgentDir: string };

export function createScriptRunTools(runtime: ConnectorRuntimeConfig): ConnectorToolDefinition[] {
  return [createScriptRunTool(runtime)];
}

function scriptDefaults(runtime: ConnectorRuntimeConfig): Required<Omit<NonNullable<ConnectorRuntimeConfig["script"]>, "agentDir" | "allow">> & { allow: string[] } {
  return {
    allow: runtime.script?.allow ?? [],
    network: runtime.script?.network === true,
    write: runtime.script?.write === true,
    timeoutMs: runtime.script?.timeoutMs ?? 60_000,
    maxOutputChars: runtime.script?.maxOutputChars ?? 12_000,
  };
}

function createScriptRunTool(runtime: ConnectorRuntimeConfig): ConnectorToolDefinition<ScriptRunParams> {
  return {
    name: "script_run",
    label: "Run Agent Script",
    description: "Run an allowlisted TypeScript/TSX script bundled under the current agent's scripts/ directory.",
    promptSnippet: "Run an allowlisted local agent script and return bounded stdout/stderr.",
    promptGuidelines: [
      "Use script_run only for scripts explicitly needed by this automation.",
      "Pass JSON-serializable input; the script receives it on stdin.",
      "Do not use script_run as a way around connector policy; only allowlisted agent scripts can run.",
    ],
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["script"],
      properties: {
        script: { type: "string", minLength: 1, description: "Relative script path under scripts/, for example scripts/search.ts." },
        input: { description: "Optional JSON-serializable input passed to stdin." },
        maxOutputChars: { type: "number", minimum: 1000, maximum: 20000, description: "Optional output bound for this call." },
      },
    },
    async execute(toolCallId, params, signal) {
      const startedAt = new Date().toISOString();
      const defaults = scriptDefaults(runtime);
      const maxOutputChars = clampNumber(params.maxOutputChars, defaults.maxOutputChars, 1_000, 20_000);
      const script = String(params.script || "").trim();

      try {
        const validated = await validateScriptPath(runtime, script, defaults.allow);
        const result = await executeScript(validated, params.input, defaults.timeoutMs, maxOutputChars, defaults.network, defaults.write, signal);
        const output = formatScriptResult(script, result, maxOutputChars);
        const outputTruncated = result.truncated || output.truncated;
        const finishedAt = new Date().toISOString();
        const status = result.exitCode === 0 && !result.timedOut ? "succeeded" : "failed";
        const summary = connectorSummary({
          runId: runtime.runId,
          automation: runtime.automationName,
          agent: runtime.agentName,
          toolCallId,
          intent: "script.run",
          toolName: "script_run",
          connector: "local-script",
          status,
          startedAt,
          finishedAt,
          script,
          resultSummary: {
            script,
            exitCode: result.exitCode,
            signal: result.signal,
            timeout: result.timedOut,
            outputChars: result.stdoutChars + result.stderrChars,
            stdoutChars: result.stdoutChars,
            stderrChars: result.stderrChars,
            truncated: outputTruncated,
            network: defaults.network,
            write: defaults.write,
          },
          error: status === "failed" ? scriptFailureMessage(result) : undefined,
        });
        return { content: [{ type: "text", text: output.text }], details: { connectorSummary: summary } };
      } catch (error) {
        return scriptFailureResult({ runtime, toolCallId, startedAt, script, error, network: defaults.network, write: defaults.write });
      }
    },
  };
}

async function validateScriptPath(runtime: ConnectorRuntimeConfig, requested: string, allow: string[]): Promise<ValidationResult> {
  const agentDir = runtime.script?.agentDir;
  if (!agentDir) throw new Error("script.run is missing the resolved agent folder.");
  const normalized = validateRelativeScriptPath(requested, "script");
  const allowed = allow.map((entry) => validateRelativeScriptPath(entry, "allow entry"));
  if (!allowed.includes(normalized)) throw new Error(`Script is not allowlisted: ${normalized}`);

  const absolutePath = path.resolve(agentDir, normalized);
  const realAgentDir = await realpath(agentDir);
  let realScriptPath: string;
  try {
    realScriptPath = await realpath(absolutePath);
    const info = await stat(realScriptPath);
    if (!info.isFile()) throw new Error("not a file");
  } catch {
    throw new Error(`Script not found: ${normalized}`);
  }
  if (!isInside(realScriptPath, realAgentDir)) {
    throw new Error(`Script resolves outside the agent folder: ${normalized}`);
  }
  return { requested: normalized, absolutePath, realScriptPath, realAgentDir };
}

function validateRelativeScriptPath(value: string, label: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) throw new Error(`${label} is required.`);
  if (trimmed.includes("\0")) throw new Error(`${label} contains an invalid null byte.`);
  if (trimmed.includes("\\")) throw new Error(`${label} must use forward slashes.`);
  if (path.isAbsolute(trimmed) || /^[a-zA-Z]:\//.test(trimmed)) throw new Error(`${label} must be relative.`);
  const normalized = path.posix.normalize(trimmed);
  if (normalized !== trimmed || normalized.startsWith("../") || normalized.includes("/../") || normalized === "..") {
    throw new Error(`${label} must not contain path traversal.`);
  }
  if (!normalized.startsWith("scripts/")) throw new Error(`${label} must be under scripts/.`);
  if (!/\.(ts|tsx)$/.test(normalized)) throw new Error(`${label} must be a .ts or .tsx file.`);
  return normalized;
}

function isInside(childPath: string, parentPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

async function executeScript(validated: ValidationResult, input: unknown, timeoutMs: number, maxOutputChars: number, network: boolean, write: boolean, signal?: AbortSignal): Promise<ScriptExecutionResult> {
  const outputLimit = Math.max(maxOutputChars * 2, maxOutputChars + 1000);
  const child = spawn("tsx", [validated.realScriptPath], {
    cwd: validated.realAgentDir,
    env: buildScriptEnv(validated, timeoutMs, network, write),
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  let stdoutChars = 0;
  let stderrChars = 0;
  let truncated = false;
  let timedOut = false;
  let settled = false;

  const append = (current: string, chunk: Buffer): { value: string; chars: number; truncated: boolean } => {
    const text = chunk.toString("utf8");
    const chars = text.length;
    const combined = current + text;
    if (combined.length <= outputLimit) return { value: combined, chars, truncated: false };
    return { value: combined.slice(0, outputLimit), chars, truncated: true };
  };

  child.stdout.on("data", (chunk: Buffer) => {
    const next = append(stdout, chunk);
    stdout = next.value;
    stdoutChars += next.chars;
    truncated = truncated || next.truncated;
  });
  child.stderr.on("data", (chunk: Buffer) => {
    const next = append(stderr, chunk);
    stderr = next.value;
    stderrChars += next.chars;
    truncated = truncated || next.truncated;
  });

  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
    setTimeout(() => {
      if (!settled) child.kill("SIGKILL");
    }, 1000).unref();
  }, timeoutMs);
  timeout.unref();

  const onAbort = (): void => {
    child.kill("SIGTERM");
  };
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    child.stdin.end(JSON.stringify(input ?? {}));
  } catch {
    // Ignore stdin errors; the child may have exited before reading input.
  }

  return await new Promise<ScriptExecutionResult>((resolve, reject) => {
    child.on("error", (error) => {
      clearTimeout(timeout);
      if (signal) signal.removeEventListener("abort", onAbort);
      settled = true;
      reject(error);
    });
    child.on("close", (exitCode, closeSignal) => {
      clearTimeout(timeout);
      if (signal) signal.removeEventListener("abort", onAbort);
      settled = true;
      resolve({ exitCode, signal: closeSignal, stdout, stderr, timedOut, truncated, stdoutChars, stderrChars });
    });
  });
}

function buildScriptEnv(validated: ValidationResult, timeoutMs: number, network: boolean, write: boolean): NodeJS.ProcessEnv {
  return {
    ...minimalInheritedEnv(),
    JUMPYGOATHQ_AGENT_DIR: validated.realAgentDir,
    JUMPYGOATHQ_SCRIPT_PATH: validated.requested,
    JUMPYGOATHQ_SCRIPT_REAL_PATH: validated.realScriptPath,
    JUMPYGOATHQ_SCRIPT_NETWORK: String(network),
    JUMPYGOATHQ_SCRIPT_WRITE: String(write),
    JUMPYGOATHQ_SCRIPT_TIMEOUT_MS: String(timeoutMs),
    JUMPYGOATHQ_SCRIPT_INPUT: "stdin-json",
  };
}

function minimalInheritedEnv(): NodeJS.ProcessEnv {
  const keep = ["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "USER", "LOGNAME", "SHELL", "LANG", "LC_ALL", "NODE_OPTIONS"];
  return Object.fromEntries(keep.flatMap((name) => process.env[name] === undefined ? [] : [[name, process.env[name]]])) as NodeJS.ProcessEnv;
}

function formatScriptResult(script: string, result: ScriptExecutionResult, maxOutputChars: number): { text: string; truncated: boolean } {
  const sections = [`script_run ${result.exitCode === 0 && !result.timedOut ? "succeeded" : "failed"}: ${script}`];
  if (result.timedOut) sections.push("Timed out before completion.");
  if (result.exitCode !== 0) sections.push(`Exit code: ${result.exitCode ?? "unknown"}${result.signal ? ` (${result.signal})` : ""}`);
  if (result.stdout.trim()) sections.push(`STDOUT:\n${result.stdout.trimEnd()}`);
  if (result.stderr.trim()) sections.push(`STDERR:\n${result.stderr.trimEnd()}`);
  const combined = sections.join("\n\n");
  const truncated = truncateText(combined, maxOutputChars);
  return { text: truncated.text, truncated: truncated.truncated };
}

function scriptFailureMessage(result: ScriptExecutionResult): string {
  if (result.timedOut) return "Script timed out.";
  if (result.exitCode !== 0) return `Script exited with code ${result.exitCode ?? "unknown"}.`;
  return "Script failed.";
}

function scriptFailureResult(args: {
  runtime: ConnectorRuntimeConfig;
  toolCallId: string;
  startedAt: string;
  script: string;
  error: unknown;
  network: boolean;
  write: boolean;
}): ConnectorToolResult {
  const message = errorMessage(args.error);
  const finishedAt = new Date().toISOString();
  const summary = connectorSummary({
    runId: args.runtime.runId,
    automation: args.runtime.automationName,
    agent: args.runtime.agentName,
    toolCallId: args.toolCallId,
    intent: "script.run",
    toolName: "script_run",
    connector: "local-script",
    status: "failed",
    startedAt: args.startedAt,
    finishedAt,
    script: args.script,
    resultSummary: { script: args.script, network: args.network, write: args.write },
    error: message,
  });
  return { content: [{ type: "text", text: `script_run failed: ${message}` }], details: { connectorSummary: summary } };
}
