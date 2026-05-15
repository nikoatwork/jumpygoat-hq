#!/usr/bin/env tsx
import { assertAutomationName, buildCronBlock, readCrontab, removeBlock, writeCrontab } from "./cron-utils.js";

async function main(): Promise<void> {
  const name = assertAutomationName(process.argv[2]);
  const current = readCrontab();
  const withoutOld = removeBlock(current, name);
  const block = await buildCronBlock(name);
  const next = [withoutOld, block].filter(Boolean).join("\n\n") + "\n";
  writeCrontab(next);
  console.log(`Installed cron for automation: ${name}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
