#!/usr/bin/env tsx
import { assertAutomationName, readCrontab, removeBlock, writeCrontab } from "./cron-utils.js";

async function main(): Promise<void> {
  const name = assertAutomationName(process.argv[2]);
  const current = readCrontab();
  const next = removeBlock(current, name).trimEnd() + "\n";
  writeCrontab(next);
  console.log(`Uninstalled cron for automation: ${name}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
