import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createScriptRunTools, resolveConnectorPlan } from "../../src/connectors/index.js";
import type { AgentMeta } from "../../src/agent.js";
import type { Automation } from "../../src/automation.js";
import { invocationFromAutomation } from "../../src/invocation.js";
import { bootSmokeScript, main, printHelp, printResult, summarizeToolResult, tool } from "./lib.js";

const HELP = `
local script.run connector smoke

Creates a temporary agent script, executes it through the script_run connector, then deletes it.

Usage:
  pnpm --filter @jumpygoat-hq/runner smoke:script-run
  pnpm --filter @jumpygoat-hq/runner smoke:script-run -- --json
`;

type ScriptRunParams = { script: string; input?: Record<string, unknown> };

await main(async () => {
  const flags = bootSmokeScript();
  if (flags.help) return printHelp(HELP);

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "jghq-script-smoke-"));
  try {
    const agentDir = path.join(tempDir, "agent");
    await mkdir(path.join(agentDir, "scripts"), { recursive: true });
    await writeFile(path.join(agentDir, "AGENT.md"), "# Connector smoke agent\n", "utf8");
    await writeFile(path.join(agentDir, "scripts", "echo.ts"), `
import { readFileSync } from "node:fs";
const input = JSON.parse(readFileSync(0, "utf8") || "{}");
console.log(JSON.stringify({ ok: true, input, cwd: process.cwd(), script: process.env.JUMPYGOATHQ_SCRIPT_PATH }));
`, "utf8");

    const automation: Automation = {
      name: "script-run-smoke",
      agent: "connector-smoke",
      prompt: "script.run smoke",
      scripts: { run: { enabled: true, connector: "local-script", allow: ["scripts/echo.ts"], timeoutMs: 10_000, maxOutputChars: 4000 } },
    };
    const agent: AgentMeta = { name: "connector-smoke", allowedIntents: ["script.run"], path: path.join(agentDir, "AGENT.md") };
    const plan = resolveConnectorPlan({ invocation: invocationFromAutomation(automation), agent, runId: `smoke-script-run-${Date.now()}` });
    const result = await tool<ScriptRunParams>(createScriptRunTools(plan), "script_run").execute("smoke-script", { script: "scripts/echo.ts", input: { smoke: true } });
    const summary = { connector: "local-script", result: summarizeToolResult(result) };
    printResult(flags, summary, "script.run smoke ok: temporary script executed through connector.");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
