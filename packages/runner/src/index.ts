#!/usr/bin/env node
import { loadDotEnv } from "./env.js";

loadDotEnv();
import { loadAutomation } from "./automation.js";
import { executeInvocation } from "./execute.js";
import { invocationFromAutomation } from "./invocation.js";

async function main(): Promise<number> {
  const name = process.argv[2];
  if (!name || name === "-h" || name === "--help") {
    console.error("Usage: agenthq-runner <automation-name>");
    return name ? 0 : 1;
  }

  const automation = await loadAutomation(name);
  const result = await executeInvocation(invocationFromAutomation(automation));
  return result.exitCode ?? 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
