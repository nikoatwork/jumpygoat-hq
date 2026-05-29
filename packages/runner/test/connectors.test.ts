import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createAgentMailTools, createFirecrawlTools, createResendTools, createScriptRunTools, extractConnectorActionsFromTrace, resolveConnectorPlan } from "../src/connectors/index.js";
import type { AgentMeta } from "../src/agent.js";
import type { Automation } from "../src/automation.js";
import { invocationFromAutomation } from "../src/invocation.js";

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
  await testAutomationInvocationCarriesConnectorOverrides();
  await testFirecrawlSearch();
  await testFirecrawlScrapeAndCrawl();
  await testFirecrawlErrorResponses();
  await testFirecrawlMissingKey();
  await testResendSuccessAndTrace();
  await testResendMissingConfig();
  await testAgentMailSendAndList();
  await testAgentMailMissingConfig();
  await testScriptRunGatingAndExecution();
  await testScriptRunPathSafetyAndFailures();
  console.log("connector tests ok");
}

async function testGating(): Promise<void> {
  const plan = resolveConnectorPlan({ automation, agent, runId: "run-1" });
  assert.deepEqual(plan.tools.map((tool) => tool.intent), ["web.search", "notify.email"]);
}

async function testAutomationInvocationCarriesConnectorOverrides(): Promise<void> {
  const withMailAndScripts: Automation = {
    ...automation,
    mail: { send: { enabled: true, connector: "agentmail", inboxId: "agent@agentmail.to", to: "to@example.com" } },
    scripts: { run: { enabled: true, connector: "local-script", allow: ["scripts/check.ts"] } },
  };
  const invocation = invocationFromAutomation(withMailAndScripts);
  assert.deepEqual(invocation.mail, withMailAndScripts.mail);
  assert.deepEqual(invocation.scripts, withMailAndScripts.scripts);

  const plan = resolveConnectorPlan({ invocation, agent: { ...agent, allowedIntents: ["mail.send", "script.run"] }, runId: "run-invocation" });
  assert.deepEqual(plan.tools.map((tool) => tool.intent), ["mail.send", "script.run"]);
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
    assert.equal((init?.headers as Record<string, string>)["idempotency-key"], "jumpygoathq:run-1:call-3");
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
  const previousTo = process.env.JUMPYGOATHQ_NOTIFY_EMAIL_TO;
  const previousFrom = process.env.JUMPYGOATHQ_NOTIFY_EMAIL_FROM;
  process.env.RESEND_API_KEY = "test-resend";
  delete process.env.JUMPYGOATHQ_NOTIFY_EMAIL_TO;
  delete process.env.JUMPYGOATHQ_NOTIFY_EMAIL_FROM;
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
    restoreEnv("JUMPYGOATHQ_NOTIFY_EMAIL_TO", previousTo);
    restoreEnv("JUMPYGOATHQ_NOTIFY_EMAIL_FROM", previousFrom);
  }
}

async function testAgentMailSendAndList(): Promise<void> {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.AGENTMAIL_API_KEY;
  const calls: string[] = [];
  process.env.AGENTMAIL_API_KEY = "test-agentmail";
  globalThis.fetch = async (input, init) => {
    calls.push(`${init?.method || "GET"} ${String(input)}`);
    const auth = (init?.headers as Record<string, string>).authorization;
    assert.equal(auth, "Bearer test-agentmail");
    if (String(input).endsWith("/v0/inboxes/agent%40agentmail.to/messages/send")) {
      const body = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
      assert.equal(body.subject, "[agent] Hello");
      assert.equal(body.to, "to@example.com");
      return new Response(JSON.stringify({ message_id: "msg-123", thread_id: "thr-123" }), { status: 200 });
    }
    if (String(input).includes("/v0/inboxes/agent%40agentmail.to/messages?")) {
      assert.match(String(input), /limit=2/);
      assert.match(String(input), /labels=unread/);
      return new Response(JSON.stringify({ count: 1, messages: [{ message_id: "msg-in", thread_id: "thr-in", from: "sender@example.com", to: ["agent@agentmail.to"], subject: "Inbound", preview: "Reply body", labels: ["unread"], timestamp: "2026-05-29T00:00:00Z" }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ message: "unexpected" }), { status: 500 });
  };

  try {
    const agentmailAutomation: Automation = {
      ...automation,
      mail: {
        send: { enabled: true, connector: "agentmail", inboxId: "agent@agentmail.to", to: "to@example.com", subjectPrefix: "[agent] " },
        list: { enabled: true, connector: "agentmail", inboxId: "agent@agentmail.to", limit: 2, labels: ["unread"] },
      },
    };
    const plan = resolveConnectorPlan({ automation: agentmailAutomation, agent: { ...agent, allowedIntents: ["mail.send", "mail.list"] }, runId: "run-mail" });
    assert.deepEqual(plan.tools.map((tool) => tool.intent), ["mail.send", "mail.list"]);
    const tools = createAgentMailTools(plan);
    const send = tools.find((entry) => entry.name === "mail_send");
    const list = tools.find((entry) => entry.name === "mail_list");
    assert.ok(send);
    assert.ok(list);
    const sendResult = await send.execute("call-send", { subject: "Hello", text: "World" });
    assert.match(sendResult.content[0]?.text ?? "", /msg-123/);
    assert.equal((sendResult.details?.connectorSummary as { connector?: string }).connector, "agentmail");
    const listResult = await list.execute("call-list", {});
    assert.match(listResult.content[0]?.text ?? "", /Inbound/);
    assert.deepEqual(calls, [
      "POST https://api.agentmail.to/v0/inboxes/agent%40agentmail.to/messages/send",
      "GET https://api.agentmail.to/v0/inboxes/agent%40agentmail.to/messages?limit=2&labels=unread",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("AGENTMAIL_API_KEY", originalKey);
  }
}

async function testAgentMailMissingConfig(): Promise<void> {
  const originalKey = process.env.AGENTMAIL_API_KEY;
  const previousInbox = process.env.AGENTMAIL_INBOX_ID;
  process.env.AGENTMAIL_API_KEY = "test-agentmail";
  delete process.env.AGENTMAIL_INBOX_ID;
  const plan = resolveConnectorPlan({
    automation: { ...automation, mail: { list: { enabled: true, connector: "agentmail" } } },
    agent: { ...agent, allowedIntents: ["mail.list"] },
    runId: "run-mail",
  });
  try {
    const tool = createAgentMailTools(plan).find((entry) => entry.name === "mail_list");
    assert.ok(tool);
    await assert.rejects(() => tool.execute("call-missing-mail", {}), /Missing mail.list.inboxId/);
  } finally {
    restoreEnv("AGENTMAIL_API_KEY", originalKey);
    restoreEnv("AGENTMAIL_INBOX_ID", previousInbox);
  }
}

async function testScriptRunGatingAndExecution(): Promise<void> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "jghq-script-"));
  try {
    const agentDir = path.join(tempDir, "agent");
    await mkdir(path.join(agentDir, "scripts"), { recursive: true });
    await writeFile(path.join(agentDir, "AGENT.md"), "# Script Agent\n");
    await writeFile(path.join(agentDir, "scripts", "echo.ts"), `
import { readFileSync } from "node:fs";
const input = JSON.parse(readFileSync(0, "utf8") || "{}");
console.log(JSON.stringify({ ok: true, input, cwd: process.cwd().endsWith("agent"), script: process.env.JUMPYGOATHQ_SCRIPT_PATH }));
`);

    const disabledPlan = resolveConnectorPlan({
      automation: { name: "script-auto", scripts: { run: { enabled: true, connector: "local-script", allow: ["scripts/echo.ts"] } } },
      agent: { name: "script-agent", allowedIntents: [], path: path.join(agentDir, "AGENT.md") },
      runId: "run-script",
    });
    assert.deepEqual(disabledPlan.tools, []);

    const plan = resolveConnectorPlan({
      automation: { name: "script-auto", scripts: { run: { enabled: true, connector: "local-script", allow: ["scripts/echo.ts"], timeoutMs: 10_000, maxOutputChars: 2000 } } },
      agent: { name: "script-agent", allowedIntents: ["script.run"], path: path.join(agentDir, "AGENT.md") },
      runId: "run-script",
    });
    assert.deepEqual(plan.tools.map((tool) => tool.intent), ["script.run"]);
    assert.equal(plan.script?.agentDir, agentDir);

    const tool = createScriptRunTools(plan).find((entry) => entry.name === "script_run");
    assert.ok(tool);
    const result = await tool.execute("call-script", { script: "scripts/echo.ts", input: { search: "berlin" } });
    assert.match(result.content[0]?.text ?? "", /script_run succeeded/);
    assert.match(result.content[0]?.text ?? "", /berlin/);
    const summary = result.details?.connectorSummary as { connector?: string; intent?: string; resultSummary?: { script?: string; exitCode?: number } };
    assert.equal(summary.connector, "local-script");
    assert.equal(summary.intent, "script.run");
    assert.equal(summary.resultSummary?.script, "scripts/echo.ts");
    assert.equal(summary.resultSummary?.exitCode, 0);

    const trace = [
      JSON.stringify({ type: "tool_execution_start", toolCallId: "call-script", toolName: "script_run", args: { script: "scripts/echo.ts" } }),
      JSON.stringify({ type: "tool_execution_end", toolCallId: "call-script", toolName: "script_run", result, isError: false }),
    ].join("\n");
    const actions = extractConnectorActionsFromTrace(trace);
    assert.equal(actions.length, 1);
    assert.equal(actions[0]?.connector, "local-script");
    assert.equal(actions[0]?.script, "scripts/echo.ts");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function testScriptRunPathSafetyAndFailures(): Promise<void> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "jghq-script-safety-"));
  try {
    const agentDir = path.join(tempDir, "agent");
    const outsideDir = path.join(tempDir, "outside");
    await mkdir(path.join(agentDir, "scripts"), { recursive: true });
    await mkdir(outsideDir, { recursive: true });
    await writeFile(path.join(agentDir, "AGENT.md"), "# Script Agent\n");
    await writeFile(path.join(agentDir, "scripts", "fail.ts"), "console.error('bad'); process.exit(7);\n");
    await writeFile(path.join(agentDir, "scripts", "sleep.ts"), "setTimeout(() => console.log('late'), 1000);\n");
    await writeFile(path.join(outsideDir, "escape.ts"), "console.log('escape');\n");
    await symlink(path.join(outsideDir, "escape.ts"), path.join(agentDir, "scripts", "escape.ts"));

    const plan = resolveConnectorPlan({
      automation: { name: "script-auto", scripts: { run: { enabled: true, connector: "local-script", allow: ["scripts/fail.ts", "scripts/escape.ts", "scripts/sleep.ts"], timeoutMs: 10_000 } } },
      agent: { name: "script-agent", allowedIntents: ["script.run"], path: path.join(agentDir, "AGENT.md") },
      runId: "run-script",
    });
    const tool = createScriptRunTools(plan).find((entry) => entry.name === "script_run");
    assert.ok(tool);

    const absolute = await tool.execute("call-abs", { script: path.join(agentDir, "scripts", "fail.ts") });
    assert.match(absolute.content[0]?.text ?? "", /must be relative/);
    assert.equal((absolute.details?.connectorSummary as { status?: string }).status, "failed");

    const traversal = await tool.execute("call-dotdot", { script: "scripts/../fail.ts" });
    assert.match(traversal.content[0]?.text ?? "", /path traversal/);

    const unallowlisted = await tool.execute("call-unallowed", { script: "scripts/missing.ts" });
    assert.match(unallowlisted.content[0]?.text ?? "", /not allowlisted/);

    const symlinkEscape = await tool.execute("call-escape", { script: "scripts/escape.ts" });
    assert.match(symlinkEscape.content[0]?.text ?? "", /outside the agent folder/);

    const failed = await tool.execute("call-fail", { script: "scripts/fail.ts" });
    assert.match(failed.content[0]?.text ?? "", /Exit code: 7/);
    const failedSummary = failed.details?.connectorSummary as { status?: string; resultSummary?: { exitCode?: number } };
    assert.equal(failedSummary.status, "failed");
    assert.equal(failedSummary.resultSummary?.exitCode, 7);

    const timeoutPlan = resolveConnectorPlan({
      automation: { name: "script-auto", scripts: { run: { enabled: true, connector: "local-script", allow: ["scripts/sleep.ts"], timeoutMs: 50 } } },
      agent: { name: "script-agent", allowedIntents: ["script.run"], path: path.join(agentDir, "AGENT.md") },
      runId: "run-script",
    });
    const timeoutTool = createScriptRunTools(timeoutPlan).find((entry) => entry.name === "script_run");
    assert.ok(timeoutTool);
    const timedOut = await timeoutTool.execute("call-timeout", { script: "scripts/sleep.ts" });
    assert.match(timedOut.content[0]?.text ?? "", /Timed out/);
    assert.equal((timedOut.details?.connectorSummary as { status?: string; resultSummary?: { timeout?: boolean } }).resultSummary?.timeout, true);

    const originalPath = process.env.PATH;
    process.env.PATH = "/not-a-real-path";
    try {
      const missingTsx = await tool.execute("call-missing-tsx", { script: "scripts/fail.ts" });
      assert.match(missingTsx.content[0]?.text ?? "", /ENOENT|spawn tsx/);
      assert.equal((missingTsx.details?.connectorSummary as { status?: string }).status, "failed");
    } finally {
      restoreEnv("PATH", originalPath);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

await main();
