#!/usr/bin/env node
import { loadDotEnv } from "./env.js";

loadDotEnv();
import { loadAutomation } from "./automation.js";
import { executeInvocation } from "./execute.js";
import { invocationFromAutomation } from "./invocation.js";
import { createLogger } from "../../shared/logger.js";

const runnerLogger = createLogger({ component: "runner", file: "runner.jsonl" });

type RunnerCliArgs = {
  name?: string;
  cronMode: boolean;
  help: boolean;
};

function parseArgs(argv: string[]): RunnerCliArgs {
  const parsed: RunnerCliArgs = {
    cronMode: process.env.JUMPYGOATHQ_FROM_CRON === "1",
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--from-cron") {
      parsed.cronMode = true;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      parsed.help = true;
      continue;
    }
    if (!parsed.name) {
      parsed.name = arg;
      continue;
    }
  }

  return parsed;
}

async function main(): Promise<number> {
  const { name, cronMode, help } = parseArgs(process.argv.slice(2));
  if (!name || help) {
    console.error("Usage: jumpygoat-hq-runner [--from-cron] <automation-name>");
    return name ? 0 : 1;
  }

  const automation = await loadAutomation(name);
  if (cronMode && (!automation.schedule || automation.schedule === "manual")) {
    console.log(`Skipping cron run for automation ${name}: frontmatter schedule is manual.`);
    runnerLogger.info("cron_skip_manual", {
      automation: name,
      source_type: "automation",
      source_id: name,
      agent: automation.agent,
      schedule: automation.schedule ?? null,
    });
    return 0;
  }

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
      automation: process.argv.slice(2).find((arg) => arg !== "--from-cron" && arg !== "-h" && arg !== "--help"),
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
