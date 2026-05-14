#!/usr/bin/env tsx
import { readCrontab } from "./cron-utils.js";

const lines = readCrontab().split("\n");
let printing = false;
let found = false;

for (const line of lines) {
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
