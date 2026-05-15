import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadAutomation } from "../packages/runner/src/automation.js";
import { dataDir, repoRoot } from "../packages/shared/paths.js";

export const TASK_HEARTBEAT_NAME = "task-heartbeat";
export const DEFAULT_TASK_HEARTBEAT_SCHEDULE = "0 * * * *";
export const DEFAULT_TASK_HEARTBEAT_LIMIT = 1;

type TaskHeartbeatOptions = {
  schedule?: string;
  limit?: number;
};

export type TaskHeartbeatCronStatus = {
  installed: boolean;
  block: string;
  line: string;
  warning?: string;
};

export function readCrontab(): string {
  const testFile = process.env.JUMPYGOATHQ_CRONTAB_FILE?.trim();
  if (testFile) return existsSync(testFile) ? readFileSync(testFile, "utf8") : "";
  try {
    return execFileSync("crontab", ["-l"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return "";
  }
}

export function writeCrontab(content: string): void {
  const testFile = process.env.JUMPYGOATHQ_CRONTAB_FILE?.trim();
  if (testFile) {
    mkdirSync(path.dirname(testFile), { recursive: true });
    writeFileSync(testFile, content, "utf8");
    return;
  }
  execFileSync("crontab", ["-"], { input: content, encoding: "utf8" });
}

export function removeBlock(crontab: string, name: string): string {
  return removeMarkedBlock(crontab, markerStart(name), markerEnd(name));
}

export function removeTaskHeartbeatBlock(crontab: string): string {
  return removeMarkedBlock(crontab, taskHeartbeatMarkerStart(), taskHeartbeatMarkerEnd());
}

export async function buildCronBlock(name: string): Promise<string> {
  const automation = await loadAutomation(name);
  if (!automation.schedule || automation.schedule === "manual") {
    throw new Error(`Automation ${name} has no cron schedule. Set schedule to a 5-field cron expression.`);
  }
  assertFiveFieldCron(automation.schedule);

  const root = repoRoot();
  const logDir = dataDir();
  mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, `cron-${name}.log`);
  const command = buildRepoCronCommand(root, `pnpm runner ${name}`, logFile, `cron-${name}.sh`);

  return [
    markerStart(name),
    `# ${automation.agent} via jumpyGoatHq`,
    `${automation.schedule} ${command}`,
    markerEnd(name),
  ].join("\n");
}

export function buildTaskHeartbeatCronBlock(options: TaskHeartbeatOptions = {}): string {
  const schedule = options.schedule || process.env.JUMPYGOATHQ_TASK_HEARTBEAT_CRON || DEFAULT_TASK_HEARTBEAT_SCHEDULE;
  const limit = options.limit ?? parsePositiveInteger(process.env.JUMPYGOATHQ_TASK_DISPATCH_LIMIT, DEFAULT_TASK_HEARTBEAT_LIMIT, "JUMPYGOATHQ_TASK_DISPATCH_LIMIT");
  assertFiveFieldCron(schedule);
  assertPositiveInteger(limit, "task heartbeat limit");

  const root = repoRoot();
  const logDir = dataDir();
  mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, "cron-task-heartbeat.log");
  const command = buildRepoCronCommand(root, `pnpm dispatch:tasks --limit=${limit}`, logFile, "cron-task-heartbeat.sh");

  return [
    taskHeartbeatMarkerStart(),
    `# jumpyGoatHq task heartbeat dispatcher; scans ready assigned tasks and dispatches each task's assignee agent`,
    `${schedule} ${command}`,
    taskHeartbeatMarkerEnd(),
  ].join("\n");
}

export function readTaskHeartbeatCronStatus(crontab = readCrontab()): TaskHeartbeatCronStatus {
  const start = taskHeartbeatMarkerStart();
  const end = taskHeartbeatMarkerEnd();
  const lines = crontab.split("\n");
  const blocks: Array<{ lines: string[]; warning?: string }> = [];
  let current: string[] | undefined;

  for (const line of lines) {
    if (line.trim() === start) {
      if (current) blocks.push({ lines: current, warning: "Missing end marker before another task heartbeat block." });
      current = [line];
      continue;
    }
    if (line.trim() === end) {
      if (!current) {
        blocks.push({ lines: [line], warning: "End marker without matching task heartbeat start marker." });
        continue;
      }
      current.push(line);
      blocks.push({ lines: current });
      current = undefined;
      continue;
    }
    if (current) current.push(line);
  }

  if (current) blocks.push({ lines: current, warning: "Missing end marker for task heartbeat block." });
  if (blocks.length === 0) return { installed: false, block: "", line: "" };

  const block = blocks[0]!;
  const warnings = [block.warning];
  if (blocks.length > 1) warnings.push(`Multiple task heartbeat blocks found (${blocks.length}).`);
  const line = block.lines.find((entry) => entry.trim() && !entry.trim().startsWith("#")) || "";
  if (!line) warnings.push("No cron command line found in task heartbeat block.");

  return {
    installed: true,
    block: block.lines.join("\n"),
    line,
    warning: warnings.filter(Boolean).join(" ") || undefined,
  };
}

export function markerStart(name: string): string {
  return `# jumpygoathq:start ${name}`;
}

export function markerEnd(name: string): string {
  return `# jumpygoathq:end ${name}`;
}

export function taskHeartbeatMarkerStart(): string {
  return "# jumpygoathq:task-heartbeat:start";
}

export function taskHeartbeatMarkerEnd(): string {
  return "# jumpygoathq:task-heartbeat:end";
}

export function assertAutomationName(name: string | undefined): string {
  if (!name) throw new Error("Usage: <script> <automation-name>");
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Invalid automation name: ${name}`);
  if (name === TASK_HEARTBEAT_NAME) throw new Error(`${TASK_HEARTBEAT_NAME} is reserved for the task heartbeat cron block.`);
  return name;
}

export function assertFiveFieldCron(schedule: string): void {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Only 5-field cron expressions are supported for now. Got: ${schedule}`);
  }
}

function removeMarkedBlock(crontab: string, start: string, end: string): string {
  const lines = crontab.split("\n");
  const out: string[] = [];
  let skipping = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === start) {
      skipping = true;
      continue;
    }
    if (skipping) {
      if (trimmed === end) skipping = false;
      else if (isAnyStartMarker(trimmed)) {
        skipping = false;
        out.push(line);
      }
      continue;
    }
    if (trimmed === end) continue;
    out.push(line);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

function isAnyStartMarker(line: string): boolean {
  return line.startsWith("# jumpygoathq:start ") || line === taskHeartbeatMarkerStart();
}

function buildRepoCronCommand(root: string, pnpmCommand: string, logFile: string, scriptName: string): string {
  const scriptFile = path.join(dataDir(), scriptName);
  const exports = [
    `export HOME=${shellQuote(process.env.HOME || "")}`,
    `export PATH=${shellQuote(process.env.PATH || "/usr/local/bin:/usr/bin:/bin")}`,
  ];
  if (process.env.JUMPYGOATHQ_HOME) exports.push(`export JUMPYGOATHQ_HOME=${shellQuote(process.env.JUMPYGOATHQ_HOME)}`);
  if (process.env.JUMPYGOATHQ_DB_PATH) exports.push(`export JUMPYGOATHQ_DB_PATH=${shellQuote(process.env.JUMPYGOATHQ_DB_PATH)}`);
  const script = [
    "#!/usr/bin/env bash",
    "set -uo pipefail",
    ...exports,
    `LOG_FILE=${shellQuote(logFile)}`,
    `cd ${shellQuote(root)}`,
    `echo "[jumpygoathq:cron] start ts=$(date -Is) cwd=$(pwd) home=\${JUMPYGOATHQ_HOME:-} command=${escapeCronLogValue(pnpmCommand)}" >> "$LOG_FILE"`,
    `${pnpmCommand} >> "$LOG_FILE" 2>&1`,
    "status=$?",
    `echo "[jumpygoathq:cron] end ts=$(date -Is) exit_code=$status" >> "$LOG_FILE"`,
    "exit $status",
    "",
  ].join("\n");
  mkdirSync(path.dirname(scriptFile), { recursive: true });
  writeFileSync(scriptFile, script, "utf8");
  chmodSync(scriptFile, 0o700);
  return `/bin/bash ${shellQuote(scriptFile)}`;
}

function parsePositiveInteger(value: string | undefined, fallback: number, field: string): number {
  if (!value || !value.trim()) return fallback;
  const parsed = Number(value);
  assertPositiveInteger(parsed, field);
  return parsed;
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${field} must be a positive integer.`);
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function escapeCronLogValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\$/g, "\\$").replace(/`/g, "\\`").replace(/\"/g, "\\\"").replace(/[\r\n]/g, " ");
}
