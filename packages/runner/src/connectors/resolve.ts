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
    to: email.to || process.env.AGENTHQ_NOTIFY_EMAIL_TO,
    from: email.from || process.env.AGENTHQ_NOTIFY_EMAIL_FROM,
    subjectPrefix: email.subjectPrefix ?? process.env.AGENTHQ_NOTIFY_SUBJECT_PREFIX ?? "",
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

export function connectorPlanEnv(plan: ConnectorPlan): string {
  return JSON.stringify(plan);
}

export function connectorToolNames(plan: ConnectorPlan): ConnectorToolName[] {
  return plan.tools.map((tool) => tool.toolName);
}
