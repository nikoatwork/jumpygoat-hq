import type { Automation } from "../automation.js";
import type { SkillMeta } from "../skill.js";
import type { ConnectorIntent, ConnectorPlan, ConnectorProvider, ConnectorToolName, ResolvedConnectorTool } from "./types.js";
import { INTENT_TO_TOOL_NAME } from "./types.js";

const INTENT_PROVIDER: Record<ConnectorIntent, ConnectorProvider> = {
  "web.search": "firecrawl",
  "web.scrape": "firecrawl",
  "web.crawl": "firecrawl",
  "notify.email": "resend",
};

export function resolveConnectorPlan(args: {
  automation: Automation;
  skill: SkillMeta;
  runId: string;
}): ConnectorPlan {
  const tools: ResolvedConnectorTool[] = [];
  for (const intent of Object.keys(INTENT_PROVIDER) as ConnectorIntent[]) {
    if (!isAutomationIntentEnabled(args.automation, intent)) continue;
    if (!args.skill.allowedIntents.includes(intent)) continue;
    tools.push({ intent, toolName: INTENT_TO_TOOL_NAME[intent], connector: INTENT_PROVIDER[intent] });
  }

  return {
    runId: args.runId,
    automationName: args.automation.name,
    skillName: args.skill.name,
    tools,
    firecrawl: resolveFirecrawlRuntimeConfig(args.automation),
    resend: resolveResendRuntimeConfig(args.automation),
  };
}

export function isAutomationIntentEnabled(automation: Automation, intent: ConnectorIntent): boolean {
  if (intent === "web.search") return automation.web?.search?.enabled === true && automation.web.search.connector === "firecrawl";
  if (intent === "web.scrape") return automation.web?.scrape?.enabled === true && automation.web.scrape.connector === "firecrawl";
  if (intent === "web.crawl") return automation.web?.crawl?.enabled === true && automation.web.crawl.connector === "firecrawl";
  if (intent === "notify.email") return automation.notify?.email?.enabled === true && (automation.notify.email.connector ?? "resend") === "resend";
  return false;
}

function resolveFirecrawlRuntimeConfig(automation: Automation): ConnectorPlan["firecrawl"] {
  const configs = [automation.web?.search, automation.web?.scrape, automation.web?.crawl].filter(Boolean);
  if (!configs.length) return undefined;
  return {
    timeoutMs: firstNumber(configs.map((config) => config?.timeoutMs)),
    maxOutputChars: firstNumber(configs.map((config) => config?.maxOutputChars)),
    searchLimit: firstNumber([automation.web?.search?.limit]),
    crawlMaxPages: firstNumber([automation.web?.crawl?.maxPages]),
    crawlMaxDepth: firstNumber([automation.web?.crawl?.maxDepth]),
  };
}

function resolveResendRuntimeConfig(automation: Automation): ConnectorPlan["resend"] {
  const email = automation.notify?.email;
  if (!email) return undefined;
  return {
    to: email.to || process.env.AGENTHQ_NOTIFY_EMAIL_TO,
    from: email.from || process.env.AGENTHQ_NOTIFY_EMAIL_FROM,
    subjectPrefix: email.subjectPrefix ?? process.env.AGENTHQ_NOTIFY_SUBJECT_PREFIX ?? "",
  };
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
