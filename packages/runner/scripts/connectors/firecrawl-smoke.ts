import { createFirecrawlTools, resolveConnectorPlan } from "../../src/connectors/index.js";
import type { AgentMeta } from "../../src/agent.js";
import type { Automation } from "../../src/automation.js";
import { invocationFromAutomation } from "../../src/invocation.js";
import { bootSmokeScript, flag, main, numberFlag, printHelp, printResult, requireEnv, summarizeToolResult, tool } from "./lib.js";

const HELP = `
Firecrawl live connector smoke

Usage:
  pnpm --filter @jumpygoat-hq/runner smoke:firecrawl
  pnpm --filter @jumpygoat-hq/runner smoke:firecrawl -- --query "site:github.com nikoatwork jumpygoat" --scrape-url https://example.com

Flags:
  --query <text>       Search query, default "jumpyGoatHq GitHub"
  --limit <n>          Search limit, default 2
  --scrape-url <url>   Optional URL to scrape after search
  --json               Print full JSON summary
`;

type WebSearchParams = { query: string; limit?: number };
type WebScrapeParams = { url: string; maxOutputChars?: number };

await main(async () => {
  const flags = bootSmokeScript();
  if (flags.help) return printHelp(HELP);

  requireEnv("FIRECRAWL_API_KEY");
  const query = flag(flags, "query", "jumpyGoatHq GitHub")!;
  const limit = numberFlag(flags, "limit", 2);
  const scrapeUrl = flag(flags, "scrape-url");

  const automation: Automation = {
    name: "firecrawl-smoke",
    agent: "connector-smoke",
    prompt: "Firecrawl smoke",
    web: {
      search: { enabled: true, connector: "firecrawl", limit, maxOutputChars: 4000 },
      scrape: { enabled: Boolean(scrapeUrl), connector: "firecrawl", maxOutputChars: 4000 },
    },
  };
  const agent: AgentMeta = { name: "connector-smoke", allowedIntents: scrapeUrl ? ["web.search", "web.scrape"] : ["web.search"] };
  const plan = resolveConnectorPlan({ invocation: invocationFromAutomation(automation), agent, runId: `smoke-firecrawl-${Date.now()}` });
  const tools = createFirecrawlTools(plan);

  const searchResult = await tool<WebSearchParams>(tools, "web_search").execute("smoke-search", { query, limit });
  const summary: Record<string, unknown> = {
    connector: "firecrawl",
    searched: summarizeToolResult(searchResult),
  };

  if (scrapeUrl) {
    const scrapeResult = await tool<WebScrapeParams>(tools, "web_scrape").execute("smoke-scrape", { url: scrapeUrl, maxOutputChars: 4000 });
    summary.scraped = summarizeToolResult(scrapeResult);
  }

  printResult(flags, summary, scrapeUrl ? `Firecrawl smoke ok: searched "${query}" and scraped ${scrapeUrl}.` : `Firecrawl smoke ok: searched "${query}".`);
});
