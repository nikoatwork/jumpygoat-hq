#!/usr/bin/env tsx
import { readCrontab, readTaskHeartbeatCronStatus, removeTaskHeartbeatBlock, writeCrontab } from "./cron-utils.js";

async function main(): Promise<void> {
  const current = readCrontab();
  const status = readTaskHeartbeatCronStatus(current);
  const next = removeTaskHeartbeatBlock(current).trimEnd() + "\n";
  writeCrontab(next);
  console.log(status.installed ? "Uninstalled task heartbeat cron." : "Task heartbeat cron was not installed.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
