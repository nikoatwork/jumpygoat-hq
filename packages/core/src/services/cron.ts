import { execFile, execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { repoRoot } from "../../../shared/paths.js";
import type { CronBlockDto, CronStatusDto, TaskHeartbeatCronStatusDto } from "../dto.js";
import { assertAutomationName } from "../names.js";

export type CronInstallInput = {
  schedule?: string;
  limit?: number;
};

export type CronMutationResult = {
  stdout: string;
  stderr: string;
};

export interface CronService {
  status(): Promise<CronStatusDto>;
  installAutomation(name: string): Promise<CronMutationResult>;
  uninstallAutomation(name: string): Promise<CronMutationResult>;
  installTaskHeartbeat(input?: CronInstallInput): Promise<CronMutationResult>;
  uninstallTaskHeartbeat(): Promise<CronMutationResult>;
}

export async function getCronStatus(): Promise<CronStatusDto> {
  return {
    automations: listInstalledCronBlocks(),
    taskHeartbeat: readTaskHeartbeatCronStatus(),
  };
}

export async function installAutomationCron(name: string): Promise<CronMutationResult> {
  assertAutomationName(name);
  return runPnpmScript("install:cron", [name]);
}

export async function uninstallAutomationCron(name: string): Promise<CronMutationResult> {
  assertAutomationName(name);
  return runPnpmScript("uninstall:cron", [name]);
}

export async function installTaskHeartbeatCron(input: CronInstallInput = {}): Promise<CronMutationResult> {
  const args: string[] = [];
  if (input.schedule) args.push(`--schedule=${input.schedule}`);
  if (input.limit !== undefined) args.push(`--limit=${input.limit}`);
  return runPnpmScript("install:task-cron", args);
}

export async function uninstallTaskHeartbeatCron(): Promise<CronMutationResult> {
  return runPnpmScript("uninstall:task-cron", []);
}

export function listInstalledCronBlocks(): CronBlockDto[] {
  const text = readUserCrontab();
  if (!text) return [];

  const lines = text.split("\n");
  const blocks: CronBlockDto[] = [];
  let current: { name: string; lines: string[] } | undefined;

  const pushBlock = (block: { name: string; lines: string[] }, warning?: string) => {
    blocks.push({
      name: block.name,
      block: block.lines.join("\n"),
      line: block.lines.find((line) => line && !line.startsWith("#")) || "",
      warning,
    });
  };

  for (const line of lines) {
    const start = line.match(/^# jumpygoathq:start ([^\s]+)$/);
    const end = line.match(/^# jumpygoathq:end ([^\s]+)$/);

    if (start) {
      if (current) pushBlock(current, "Missing end marker before next jumpyGoatHq cron block.");
      current = { name: start[1]!, lines: [line] };
      continue;
    }

    if (end) {
      if (!current) {
        pushBlock({ name: end[1]!, lines: [line] }, "End marker without matching start marker.");
        continue;
      }
      current.lines.push(line);
      if (end[1] === current.name) {
        pushBlock(current);
      } else {
        pushBlock(current, `End marker name mismatch: expected ${current.name}, got ${end[1]}.`);
      }
      current = undefined;
      continue;
    }

    if (current) current.lines.push(line);
  }

  if (current) pushBlock(current, "Missing end marker for jumpyGoatHq cron block.");
  return blocks;
}

export function readTaskHeartbeatCronStatus(): TaskHeartbeatCronStatusDto {
  const text = readUserCrontab();
  if (!text) return { installed: false, block: "", line: "" };

  const start = "# jumpygoathq:task-heartbeat:start";
  const end = "# jumpygoathq:task-heartbeat:end";
  const blocks: Array<{ lines: string[]; warning?: string }> = [];
  let current: string[] | undefined;

  for (const line of text.split("\n")) {
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

function readUserCrontab(): string {
  const testFile = process.env.JUMPYGOATHQ_CRONTAB_FILE?.trim();
  if (testFile) {
    try {
      return existsSync(testFile) ? readFileSync(testFile, "utf8") : "";
    } catch {
      return "";
    }
  }
  try {
    return execFileSync("crontab", ["-l"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return "";
  }
}

function runPnpmScript(script: string, args: string[]): Promise<CronMutationResult> {
  return new Promise((resolve, reject) => {
    execFile("pnpm", [script, ...args], { cwd: repoRoot(), env: process.env, timeout: 1000 * 60 * 5 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Cron command failed: ${error.message}\n\nstdout:\n${stdout}\n\nstderr:\n${stderr}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}
