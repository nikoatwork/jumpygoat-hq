import { createApifyTools, resolveConnectorPlan } from "../../src/connectors/index.js";
import type { AgentMeta } from "../../src/agent.js";
import type { Automation } from "../../src/automation.js";
import { invocationFromAutomation } from "../../src/invocation.js";
import { bootSmokeScript, flag, main, numberFlag, printHelp, printResult, summarizeToolResult, tool } from "./lib.js";

const HELP = `
Apify live connector smoke

Usage:
  pnpm --filter @jumpygoat-hq/runner smoke:apify
  pnpm --filter @jumpygoat-hq/runner smoke:apify -- --actor apidojo/tweet-scraper --handle apify --max-items 1

Environment:
  APIFY_API_TOKEN or APIFY_API_KEY must be set in .env.local or the shell.

Flags:
  --actor <id>        Apify actor ID, default apidojo/tweet-scraper
  --handle <handle>   Twitter/X handle for the default tweet scraper input, default apify
  --max-items <n>     Actor maxItems input and preview limit, default 1
  --json              Print full JSON summary
`;

type ApifyRunActorParams = { actor?: string; input?: Record<string, unknown>; maxOutputItems?: number; maxOutputChars?: number };

await main(async () => {
  const flags = bootSmokeScript();
  if (flags.help) return printHelp(HELP);

  if (!process.env.APIFY_API_TOKEN && !process.env.APIFY_API_KEY) {
    throw new Error("Missing APIFY_API_TOKEN or APIFY_API_KEY. Add one to .env.local or export it in this shell.");
  }

  const actor = flag(flags, "actor", "apidojo/tweet-scraper")!;
  const handle = flag(flags, "handle", "apify")!;
  const maxItems = numberFlag(flags, "max-items", 1);
  const boundedMaxItems = Math.max(1, Math.min(5, Math.floor(maxItems)));

  const input = actor === "apidojo/tweet-scraper"
    ? { twitterHandles: [handle], maxItems: boundedMaxItems, sort: "Latest", tweetLanguage: "en" }
    : { maxItems: boundedMaxItems };

  const automation: Automation = {
    name: "apify-smoke",
    agent: "connector-smoke",
    prompt: "Apify smoke",
    actors: {
      run: {
        enabled: true,
        connector: "apify",
        actor,
        input,
        maxOutputItems: boundedMaxItems,
        maxOutputChars: 4000,
        timeoutMs: 300_000,
      },
    },
  };
  const agent: AgentMeta = {
    name: "connector-smoke",
    allowedIntents: ["actor.run"],
    actors: { run: { enabled: true, connector: "apify", allow: [actor] } },
  };
  const plan = resolveConnectorPlan({ invocation: invocationFromAutomation(automation), agent, runId: `smoke-apify-${Date.now()}` });
  const tools = createApifyTools(plan);

  const result = await tool<ApifyRunActorParams>(tools, "apify_run_actor").execute("smoke-apify", { maxOutputItems: boundedMaxItems, maxOutputChars: 4000 });
  const summary = {
    connector: "apify",
    actor,
    maxItems: boundedMaxItems,
    result: summarizeToolResult(result),
  };

  printResult(flags, summary, `Apify smoke ok: ran ${actor} with maxItems=${boundedMaxItems}.`);
});
