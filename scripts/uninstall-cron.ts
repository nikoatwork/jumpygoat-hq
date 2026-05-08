#!/usr/bin/env tsx
import { assertAutomationName, readCrontab, removeBlock, writeCrontab } from "./cron-utils.js";

const name = assertAutomationName(process.argv[2]);
const current = readCrontab();
const next = removeBlock(current, name).trimEnd() + "\n";
writeCrontab(next);
console.log(`Uninstalled cron for automation: ${name}`);
