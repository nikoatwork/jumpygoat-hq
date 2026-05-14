export const CONNECTOR_INTENTS = ["web.search", "web.scrape", "web.crawl", "notify.email"] as const;
export type ConnectorIntent = (typeof CONNECTOR_INTENTS)[number];

export const INTENT_TO_TOOL_NAME: Record<ConnectorIntent, ConnectorToolName> = {
  "web.search": "web_search",
  "web.scrape": "web_scrape",
  "web.crawl": "web_crawl",
  "notify.email": "notify_email",
};

export const TOOL_NAME_TO_INTENT: Record<ConnectorToolName, ConnectorIntent> = {
  web_search: "web.search",
  web_scrape: "web.scrape",
  web_crawl: "web.crawl",
  notify_email: "notify.email",
};

export const CONNECTOR_TOOL_NAMES = ["web_search", "web_scrape", "web_crawl", "notify_email"] as const;
export type ConnectorToolName = (typeof CONNECTOR_TOOL_NAMES)[number];
export type ConnectorProvider = "firecrawl" | "resend";
export type ConnectorActionStatus =
  | "started"
  | "succeeded"
  | "failed"
  | "sent"
  | "skipped_disabled"
  | "skipped_not_allowed"
  | "skipped_run_failed"
  | "skipped_malformed"
  | "skipped_tool_already_used"
  | "failed_missing_config"
  | "failed_delivery";

export type FirecrawlRuntimeConfig = {
  timeoutMs?: number;
  maxOutputChars?: number;
  searchLimit?: number;
  crawlMaxPages?: number;
  crawlMaxDepth?: number;
};

export type ResendRuntimeConfig = {
  to?: string;
  from?: string;
  subjectPrefix?: string;
};

export type ResolvedConnectorTool = {
  intent: ConnectorIntent;
  toolName: ConnectorToolName;
  connector: ConnectorProvider;
};

export type ConnectorRuntimeConfig = {
  runId: string;
  automationName: string;
  agentName: string;
  tools: ResolvedConnectorTool[];
  firecrawl?: FirecrawlRuntimeConfig;
  resend?: ResendRuntimeConfig;
};

export type ConnectorPlan = ConnectorRuntimeConfig;

export type ConnectorActionRecord = {
  type?: "agenthq_connector_action";
  runId?: string;
  automation?: string;
  agent?: string;
  toolCallId?: string;
  intent: ConnectorIntent | string;
  toolName?: ConnectorToolName | string;
  connector?: ConnectorProvider | string;
  status: ConnectorActionStatus | string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  to?: string;
  url?: string;
  query?: string;
  providerMessageId?: string;
  resultSummary?: Record<string, unknown>;
  error?: string;
};

export type ConnectorToolResult = {
  content: Array<{ type: "text"; text: string }>;
  details?: Record<string, unknown>;
};

export type ConnectorToolDefinition<TParams = any> = {
  name: ConnectorToolName;
  label: string;
  description: string;
  promptSnippet: string;
  promptGuidelines: string[];
  parameters: Record<string, unknown>;
  execute: (
    toolCallId: string,
    params: TParams,
    signal?: AbortSignal,
    onUpdate?: (partial: ConnectorToolResult) => void,
  ) => Promise<ConnectorToolResult>;
};

export function isConnectorIntent(value: string): value is ConnectorIntent {
  return (CONNECTOR_INTENTS as readonly string[]).includes(value);
}

export function isConnectorToolName(value: string): value is ConnectorToolName {
  return (CONNECTOR_TOOL_NAMES as readonly string[]).includes(value);
}
