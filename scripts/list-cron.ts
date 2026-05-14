#!/usr/bin/env tsx
import { readCrontab, readTaskHeartbeatCronStatus, taskHeartbeatMarkerEnd, taskHeartbeatMarkerStart } from "./cron-utils.js";

const crontab = readCrontab();
const lines = crontab.split("\n");
let printing = false;
let found = false;

const heartbeat = readTaskHeartbeatCronStatus(crontab);
if (heartbeat.installed) {
  found = true;
  console.log(heartbeat.block);
  if (heartbeat.warning) console.log(`# warning: ${heartbeat.warning}`);
  console.log();
}

for (const line of lines) {
  if (line.trim() === taskHeartbeatMarkerStart()) {
    printing = false;
    continue;
  }
  if (line.trim() === taskHeartbeatMarkerEnd()) continue;
  if (line.startsWith("# jumpygoathq:start ")) {
    printing = true;
    found = true;
  }
  if (printing) console.log(line);
  if (line.startsWith("# jumpygoathq:end ")) {
    printing = false;
    console.log();
  }
}

if (!found) console.log("No jumpyGoatHq cron entries installed.");
