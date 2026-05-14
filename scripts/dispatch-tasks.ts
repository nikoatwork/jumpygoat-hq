#!/usr/bin/env node
import { loadDotEnv } from "../packages/runner/src/env.js";

loadDotEnv();

import { dispatchTasks } from "../packages/runner/src/dispatcher.js";

function parseLimit(argv: string[]): number | undefined {
  const arg = argv.find((value) => value.startsWith("--limit="));
  if (!arg) return undefined;
  const limit = Number(arg.slice("--limit=".length));
  if (!Number.isInteger(limit) || limit < 1) throw new Error("--limit must be a positive integer.");
  return limit;
}

async function main(): Promise<number> {
  if (process.argv.includes("-h") || process.argv.includes("--help")) {
    console.log("Usage: pnpm dispatch:tasks [--limit=1]");
    return 0;
  }
  const result = await dispatchTasks({ limit: parseLimit(process.argv.slice(2)) });
  for (const message of result.messages) console.log(message);
  console.log(`summary attempted=${result.attempted} dispatched=${result.dispatched} skipped=${result.skipped}`);
  return result.dispatched > 0 || result.skipped === 0 ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
