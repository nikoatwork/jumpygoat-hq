import assert from "node:assert/strict";
import { createFirecrawlTools, createResendTools, extractConnectorActionsFromTrace, resolveConnectorPlan } from "../src/connectors/index.js";
import type { AgentMeta } from "../src/agent.js";
import type { Automation } from "../src/automation.js";

const automation: Automation = {
  name: "test-auto",
  agent: "test-agent",
  prompt: "test prompt",
  web: {
    search: { enabled: true, connector: "firecrawl", limit: 2 },
    scrape: { enabled: true, connector: "firecrawl" },
    crawl: { enabled: false, connector: "firecrawl" },
  },
  notify: {
    email: { enabled: true, connector: "resend", to: "to@example.com", from: "Agent <from@example.com>" },
  },
};

const agent: AgentMeta = {
  name: "test-agent",
  allowedIntents: ["web.search", "notify.email"],
};

async function main(): Promise<void> {
  await testGating();
  await testFirecrawlSearch();
  await testFirecrawlScrapeAndCrawl();
  await testFirecrawlErrorResponses();
  await testFirecrawlMissingKey();
  await testResendSuccessAndTrace();
  await testResendMissingConfig();
  console.log("connector tests ok");
}

async function testGating(): Promise<void> {
  const plan = resolveConnectorPlan({ automation, agent, runId: "run-1" });
  assert.deepEqual(plan.tools.map((tool) => tool.intent), ["web.search", "notify.email"]);
}

async function testFirecrawlSearch(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.FIRECRAWL_API_KEY;
  process.env.FIRECRAWL_API_KEY = "test-firecrawl";
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://api.firecrawl.dev/v1/search");
    assert.equal(init?.method, "POST");
    return new Response(JSON.stringify({ success: true, data: [{ title: "Example", url: "https://example.com", description: "A result" }] }), { status: 200 });
  };

  try {
    const plan = resolveConnectorPlan({ automation, agent, runId: "run-1" });
    const tool = createFirecrawlTools(plan).find((entry) => entry.name === "web_search");
    assert.ok(tool);
    const result = await tool.execute("call-1", { query: "example", limit: 1 });
    assert.match(result.content[0]?.text ?? "", /Example/);
    assert.equal((result.details?.connectorSummary as { intent?: string }).intent, "web.search");
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("FIRECRAWL_API_KEY", originalKey);
  }
}

async function testFirecrawlScrapeAndCrawl(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.FIRECRAWL_API_KEY;
  process.env.FIRECRAWL_API_KEY = "test-firecrawl";
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    if (String(input).endsWith("/scrape")) {
      return new Response(JSON.stringify({ success: true, data: { title: "Page", url: "https://example.com/page", markdown: "Page body" } }), { status: 200 });
    }
    if (String(input).endsWith("/crawl")) {
      return new Response(JSON.stringify({ success: true, data: [{ title: "Home", url: "https://example.com", markdown: "Home body" }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: "unexpected" }), { status: 500 });
  };

  try {
    const plan = resolveConnectorPlan({
      automation: { ...automation, web: { search: automation.web?.search, scrape: automation.web?.scrape, crawl: { enabled: true, connector: "firecrawl", maxPages: 1 } } },
      agent: { ...agent, allowedIntents: ["web.scrape", "web.crawl"] },
      runId: "run-1",
    });
    const tools = createFirecrawlTools(plan);
    const scrape = tools.find((entry) => entry.name === "web_scrape");
    const crawl = tools.find((entry) => entry.name === "web_crawl");
    assert.ok(scrape);
    assert.ok(crawl);
    assert.match((await scrape.execute("call-scrape", { url: "https://example.com/page" })).content[0]?.text ?? "", /Page body/);
    assert.match((await crawl.execute("call-crawl", { url: "https://example.com", maxPages: 1 })).content[0]?.text ?? "", /Home body/);
    assert.deepEqual(calls, ["https://api.firecrawl.dev/v1/scrape", "https://api.firecrawl.dev/v1/crawl"]);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("FIRECRAWL_API_KEY", originalKey);
  }
}

async function testFirecrawlErrorResponses(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.FIRECRAWL_API_KEY;
  process.env.FIRECRAWL_API_KEY = "test-firecrawl";
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false, error: "bad request" }), { status: 400 });

  try {
    const plan = resolveConnectorPlan({ automation, agent, runId: "run-1" });
    const tool = createFirecrawlTools(plan).find((entry) => entry.name === "web_search");
    assert.ok(tool);
    await assert.rejects(() => tool.execute("call-error", { query: "example" }), /Firecrawl API 400: bad request/);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("FIRECRAWL_API_KEY", originalKey);
  }
}

async function testFirecrawlMissingKey(): Promise<void> {
  const originalKey = process.env.FIRECRAWL_API_KEY;
  delete process.env.FIRECRAWL_API_KEY;
  const plan = resolveConnectorPlan({ automation, agent, runId: "run-1" });
  const tool = createFirecrawlTools(plan).find((entry) => entry.name === "web_search");
  assert.ok(tool);
  await assert.rejects(() => tool.execute("call-2", { query: "example" }), /Missing FIRECRAWL_API_KEY/);
  restoreEnv("FIRECRAWL_API_KEY", originalKey);
}

async function testResendSuccessAndTrace(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "test-resend";
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://api.resend.com/emails");
    assert.equal(init?.method, "POST");
    assert.equal((init?.headers as Record<string, string>)["idempotency-key"], "agenthq:run-1:call-3");
    return new Response(JSON.stringify({ id: "email-123" }), { status: 200 });
  };

  try {
    const plan = resolveConnectorPlan({ automation, agent, runId: "run-1" });
    const tool = createResendTools(plan).find((entry) => entry.name === "notify_email");
    assert.ok(tool);
    const result = await tool.execute("call-3", { subject: "Hello", body: "World" });
    assert.match(result.content[0]?.text ?? "", /email-123/);
    const trace = [
      JSON.stringify({ type: "tool_execution_start", toolCallId: "call-3", toolName: "notify_email", args: { subject: "Hello" } }),
      JSON.stringify({ type: "tool_execution_end", toolCallId: "call-3", toolName: "notify_email", result, isError: false }),
    ].join("\n");
    const actions = extractConnectorActionsFromTrace(trace);
    assert.equal(actions.length, 1);
    assert.equal(actions[0]?.status, "sent");
    assert.equal(actions[0]?.providerMessageId, "email-123");
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("RESEND_API_KEY", originalKey);
  }
}

async function testResendMissingConfig(): Promise<void> {
  const originalKey = process.env.RESEND_API_KEY;
  const previousTo = process.env.AGENTHQ_NOTIFY_EMAIL_TO;
  const previousFrom = process.env.AGENTHQ_NOTIFY_EMAIL_FROM;
  process.env.RESEND_API_KEY = "test-resend";
  delete process.env.AGENTHQ_NOTIFY_EMAIL_TO;
  delete process.env.AGENTHQ_NOTIFY_EMAIL_FROM;
  const plan = resolveConnectorPlan({
    automation: { ...automation, notify: { email: { enabled: true, connector: "resend" } } },
    agent,
    runId: "run-1",
  });
  try {
    const tool = createResendTools(plan).find((entry) => entry.name === "notify_email");
    assert.ok(tool);
    await assert.rejects(() => tool.execute("call-missing", { subject: "Hello", body: "World" }), /Missing notify.email.to/);
  } finally {
    restoreEnv("RESEND_API_KEY", originalKey);
    restoreEnv("AGENTHQ_NOTIFY_EMAIL_TO", previousTo);
    restoreEnv("AGENTHQ_NOTIFY_EMAIL_FROM", previousFrom);
  }
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

await main();
