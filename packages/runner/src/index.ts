#!/usr/bin/env node
import { loadDotEnv } from "./env.js";

loadDotEnv();
import { loadAutomation } from "./automation.js";
import { executeInvocation } from "./execute.js";
import { invocationFromAutomation } from "./invocation.js";
import { createLogger } from "../../shared/logger.js";

const runnerLogger = createLogger({ component: "runner", file: "runner.jsonl" });

async function main(): Promise<number> {
  const name = process.argv[2];
  if (!name || name === "-h" || name === "--help") {
    console.error("Usage: jumpygoat-hq-runner <automation-name>");
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
    const message = error instanceof Error ? error.message : String(error);
    runnerLogger.error("cli_error", {
      message,
      stack: error instanceof Error ? error.stack : undefined,
      automation: process.argv[2],
      pid: process.pid,
    });
    process.exitCode = 1;
  });

process.on("uncaughtException", (error) => {
  runnerLogger.error("uncaught_exception", { message: error.message, stack: error.stack, pid: process.pid });
  setImmediate(() => process.exit(1));
});

process.on("unhandledRejection", (reason) => {
  runnerLogger.error("unhandled_rejection", {
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    pid: process.pid,
  });
  setImmediate(() => process.exit(1));
});
