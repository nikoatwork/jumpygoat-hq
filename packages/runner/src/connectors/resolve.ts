import path from "node:path";
import type { AgentMeta } from "../agent.js";
import type { ConnectorOverrides } from "../automation.js";
import type { Invocation } from "../invocation.js";
import type { ConnectorIntent, ConnectorPlan, ConnectorProvider, ConnectorToolName, ResolvedConnectorTool } from "./types.js";
import { INTENT_TO_TOOL_NAME } from "./types.js";

const INTENT_PROVIDER: Record<ConnectorIntent, ConnectorProvider> = {
  "web.search": "firecrawl",
  "web.scrape": "firecrawl",
  "web.crawl": "firecrawl",
  "notify.email": "resend",
  "mail.send": "agentmail",
  "mail.list": "agentmail",
  "script.run": "local-script",
};

type ConnectorInvocation = Pick<Invocation, "name"> & ConnectorOverrides;

export function resolveConnectorPlan(args: {
  invocation: ConnectorInvocation;
  agent: AgentMeta;
  runId: string;
} | {
  automation: ConnectorInvocation;
  agent: AgentMeta;
  runId: string;
}): ConnectorPlan {
  const invocation = "invocation" in args ? args.invocation : args.automation;
  const tools: ResolvedConnectorTool[] = [];
  for (const intent of Object.keys(INTENT_PROVIDER) as ConnectorIntent[]) {
    if (!isConnectorIntentEnabled(args.agent, invocation, intent)) continue;
    if (!args.agent.allowedIntents.includes(intent)) continue;
    tools.push({ intent, toolName: INTENT_TO_TOOL_NAME[intent], connector: INTENT_PROVIDER[intent] });
  }

  return {
    runId: args.runId,
    automationName: invocation.name,
    agentName: args.agent.name,
    tools,
    firecrawl: resolveFirecrawlRuntimeConfig(args.agent, invocation),
    resend: resolveResendRuntimeConfig(args.agent, invocation),
    agentmail: resolveAgentMailRuntimeConfig(args.agent, invocation),
    script: resolveScriptRunRuntimeConfig(args.agent, invocation),
  };
}

export function isConnectorIntentEnabled(agent: ConnectorOverrides, automation: ConnectorOverrides, intent: ConnectorIntent): boolean {
  if (intent === "web.search") {
    const config = mergeConfig(agent.web?.search, automation.web?.search);
    return config?.enabled === true && config.connector === "firecrawl";
  }
  if (intent === "web.scrape") {
    const config = mergeConfig(agent.web?.scrape, automation.web?.scrape);
    return config?.enabled === true && config.connector === "firecrawl";
  }
  if (intent === "web.crawl") {
    const config = mergeConfig(agent.web?.crawl, automation.web?.crawl);
    return config?.enabled === true && config.connector === "firecrawl";
  }
  if (intent === "notify.email") {
    const config = mergeConfig(agent.notify?.email, automation.notify?.email);
    return config?.enabled === true && (config.connector ?? "resend") === "resend";
  }
  if (intent === "mail.send") {
    const config = mergeConfig(agent.mail?.send, automation.mail?.send);
    return config?.enabled === true && config.connector === "agentmail";
  }
  if (intent === "mail.list") {
    const config = mergeConfig(agent.mail?.list, automation.mail?.list);
    return config?.enabled === true && config.connector === "agentmail";
  }
  if (intent === "script.run") {
    const config = mergeConfig(agent.scripts?.run, automation.scripts?.run);
    return config?.enabled === true && config.connector === "local-script";
  }
  return false;
}

function resolveFirecrawlRuntimeConfig(agent: ConnectorOverrides, automation: ConnectorOverrides): ConnectorPlan["firecrawl"] {
  const search = mergeConfig(agent.web?.search, automation.web?.search);
  const scrape = mergeConfig(agent.web?.scrape, automation.web?.scrape);
  const crawl = mergeConfig(agent.web?.crawl, automation.web?.crawl);
  const configs = [search, scrape, crawl].filter(Boolean);
  if (!configs.length) return undefined;
  return {
    timeoutMs: firstNumber(configs.map((config) => config?.timeoutMs)),
    maxOutputChars: firstNumber(configs.map((config) => config?.maxOutputChars)),
    searchLimit: firstNumber([search?.limit]),
    crawlMaxPages: firstNumber([crawl?.maxPages]),
    crawlMaxDepth: firstNumber([crawl?.maxDepth]),
  };
}

function resolveResendRuntimeConfig(agent: ConnectorOverrides, automation: ConnectorOverrides): ConnectorPlan["resend"] {
  const email = mergeConfig(agent.notify?.email, automation.notify?.email);
  if (!email) return undefined;
  return {
    to: email.to || process.env.JUMPYGOATHQ_NOTIFY_EMAIL_TO,
    from: email.from || process.env.JUMPYGOATHQ_NOTIFY_EMAIL_FROM,
    subjectPrefix: email.subjectPrefix ?? process.env.JUMPYGOATHQ_NOTIFY_SUBJECT_PREFIX ?? "",
  };
}

function resolveAgentMailRuntimeConfig(agent: ConnectorOverrides, automation: ConnectorOverrides): ConnectorPlan["agentmail"] {
  const send = mergeConfig(agent.mail?.send, automation.mail?.send);
  const list = mergeConfig(agent.mail?.list, automation.mail?.list);
  const configs = [send, list].filter(Boolean);
  if (!configs.length) return undefined;
  return {
    inboxId: send?.inboxId || list?.inboxId || process.env.AGENTMAIL_INBOX_ID,
    to: send?.to || process.env.AGENTMAIL_TO,
    subjectPrefix: send?.subjectPrefix ?? process.env.AGENTMAIL_SUBJECT_PREFIX ?? "",
    labels: firstStringArray([list?.labels, send?.labels]),
    listLimit: firstNumber([list?.limit]),
    maxOutputChars: firstNumber([list?.maxOutputChars]),
    timeoutMs: firstNumber(configs.map((config) => config?.timeoutMs)),
  };
}

function resolveScriptRunRuntimeConfig(agent: ConnectorOverrides & { path?: string }, automation: ConnectorOverrides): ConnectorPlan["script"] {
  const run = mergeConfig(agent.scripts?.run, automation.scripts?.run);
  if (!run) return undefined;
  const agentDir = agent.path ? path.dirname(agent.path) : undefined;
  return {
    agentDir,
    allow: run.allow,
    network: run.network === true,
    write: run.write === true,
    timeoutMs: run.timeoutMs,
    maxOutputChars: run.maxOutputChars,
  };
}

function mergeConfig<T extends Record<string, unknown>>(base: T | undefined, override: T | undefined): T | undefined {
  if (!base) return override;
  if (!override) return base;
  return { ...base, ...override };
}

function firstNumber(values: Array<number | undefined>): number | undefined {
  return values.find((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function firstStringArray(values: Array<string[] | undefined>): string[] | undefined {
  return values.find((value): value is string[] => Array.isArray(value));
}

export function connectorPlanEnv(plan: ConnectorPlan): string {
  return JSON.stringify(plan);
}

export function connectorToolNames(plan: ConnectorPlan): ConnectorToolName[] {
  return plan.tools.map((tool) => tool.toolName);
}
