#!/usr/bin/env tsx
import { readCrontab, readTaskHeartbeatCronStatus } from "./cron-utils.js";

const status = readTaskHeartbeatCronStatus(readCrontab());
if (!status.installed) {
  console.log("Task heartbeat cron is not installed.");
  process.exit(0);
}
console.log("Task heartbeat cron is installed:");
console.log(status.block);
if (status.warning) console.log(`Warning: ${status.warning}`);
