#!/usr/bin/env tsx
import { buildTaskHeartbeatCronBlock, DEFAULT_TASK_HEARTBEAT_LIMIT, DEFAULT_TASK_HEARTBEAT_SCHEDULE, readCrontab, removeTaskHeartbeatBlock, writeCrontab } from "./cron-utils.js";

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const current = readCrontab();
  const withoutOld = removeTaskHeartbeatBlock(current);
  const block = buildTaskHeartbeatCronBlock(options);
  const next = [withoutOld, block].filter(Boolean).join("\n\n") + "\n";
  writeCrontab(next);
  console.log(`Installed task heartbeat cron: schedule=${options.schedule || process.env.JUMPYGOATHQ_TASK_HEARTBEAT_CRON || DEFAULT_TASK_HEARTBEAT_SCHEDULE} limit=${options.limit ?? process.env.JUMPYGOATHQ_TASK_DISPATCH_LIMIT ?? DEFAULT_TASK_HEARTBEAT_LIMIT}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

function parseArgs(argv: string[]): { schedule?: string; limit?: number } {
  const parsed: { schedule?: string; limit?: number } = {};
  for (const arg of argv) {
    if (arg === "--") continue;
    if (arg === "-h" || arg === "--help") {
      console.log("Usage: pnpm install:task-cron [--schedule='0 * * * *'] [--limit=1]");
      process.exit(0);
    }
    if (arg.startsWith("--schedule=")) {
      parsed.schedule = arg.slice("--schedule=".length).trim();
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const limit = Number(arg.slice("--limit=".length));
      if (!Number.isInteger(limit) || limit < 1) throw new Error("--limit must be a positive integer.");
      parsed.limit = limit;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}
