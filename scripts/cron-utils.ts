import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { loadAutomation } from "../packages/runner/src/automation.js";
import { repoRoot } from "../packages/runner/src/paths.js";

export function readCrontab(): string {
  try {
    return execFileSync("crontab", ["-l"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return "";
  }
}

export function writeCrontab(content: string): void {
  execFileSync("crontab", ["-"], { input: content, encoding: "utf8" });
}

export function removeBlock(crontab: string, name: string): string {
  const start = markerStart(name);
  const end = markerEnd(name);
  const lines = crontab.split("\n");
  const out: string[] = [];
  let skipping = false;

  for (const line of lines) {
    if (line.trim() === start) {
      skipping = true;
      continue;
    }
    if (line.trim() === end) {
      skipping = false;
      continue;
    }
    if (!skipping) out.push(line);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

export async function buildCronBlock(name: string): Promise<string> {
  const automation = await loadAutomation(name);
  if (!automation.schedule || automation.schedule === "manual") {
    throw new Error(`Automation ${name} has no cron schedule. Set schedule to a 5-field cron expression.`);
  }
  assertFiveFieldCron(automation.schedule);

  const root = repoRoot();
  mkdirSync(path.join(root, "data"), { recursive: true });
  const home = process.env.HOME || "";
  const pathEnv = process.env.PATH || "/usr/local/bin:/usr/bin:/bin";
  const inner = `export HOME=${shellQuote(home)} PATH=${shellQuote(pathEnv)}; pnpm runner ${name} >> data/cron-${name}.log 2>&1`;
  const command = `cd ${shellQuote(root)} && /bin/bash -lc ${shellQuote(inner)}`;

  return [
    markerStart(name),
    `# ${automation.skill} via agenthq`,
    `${automation.schedule} ${command}`,
    markerEnd(name),
  ].join("\n");
}

export function markerStart(name: string): string {
  return `# agenthq:start ${name}`;
}

export function markerEnd(name: string): string {
  return `# agenthq:end ${name}`;
}

export function assertAutomationName(name: string | undefined): string {
  if (!name) throw new Error("Usage: <script> <automation-name>");
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`Invalid automation name: ${name}`);
  return name;
}

function assertFiveFieldCron(schedule: string): void {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Only 5-field cron expressions are supported for now. Got: ${schedule}`);
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}
