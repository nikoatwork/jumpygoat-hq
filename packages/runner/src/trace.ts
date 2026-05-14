import { mkdir, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { ulid } from "ulid";
import { tracesDir } from "./paths.js";
import type { Automation } from "./automation.js";

export type Trace = {
  runId: string;
  file: string;
  startedAt: string;
};

export async function openTrace(automation: Automation, agentFile: string): Promise<Trace> {
  await mkdir(tracesDir(), { recursive: true });
  const runId = process.env.RUN_ID || ulid();
  const startedAt = new Date().toISOString();
  const file = path.join(tracesDir(), `${runId}.jsonl`);
  await writeJsonLine(file, {
    type: "jumpygoathq_run_meta",
    run_id: runId,
    automation: automation.name,
    agent: automation.agent,
    agent_file: agentFile,
    model: automation.model ?? null,
    schedule: automation.schedule ?? null,
    started_at: startedAt,
  });
  return { runId, file, startedAt };
}

export async function writeJsonLine(file: string, value: unknown): Promise<void> {
  await appendFile(file, `${JSON.stringify(value)}\n`, "utf8");
}

export async function initializeTraceFile(file: string): Promise<void> {
  await writeFile(file, "", "utf8");
}

export async function closeTrace(args: {
  file: string;
  runId: string;
  automation: Automation;
  startedAt: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
}): Promise<void> {
  const durationMs = Date.now() - Date.parse(args.startedAt);
  const status = args.exitCode === 0 ? "ok" : "error";
  await writeJsonLine(args.file, {
    type: "jumpygoathq_summary",
    run_id: args.runId,
    automation: args.automation.name,
    agent: args.automation.agent,
    model: args.automation.model ?? null,
    status,
    exit_code: args.exitCode,
    signal: args.signal,
    duration_ms: durationMs,
    finished_at: new Date().toISOString(),
  });
}
