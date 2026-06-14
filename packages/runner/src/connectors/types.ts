export const CONNECTOR_INTENTS = ["web.search", "web.scrape", "web.crawl", "notify.email", "mail.send", "mail.list", "script.run", "artifact.upload", "actor.run"] as const;
export type ConnectorIntent = (typeof CONNECTOR_INTENTS)[number];

export const INTENT_TO_TOOL_NAME: Record<ConnectorIntent, ConnectorToolName> = {
  "web.search": "web_search",
  "web.scrape": "web_scrape",
  "web.crawl": "web_crawl",
  "notify.email": "notify_email",
  "mail.send": "mail_send",
  "mail.list": "mail_list",
  "script.run": "script_run",
  "artifact.upload": "artifact_upload",
  "actor.run": "apify_run_actor",
};

export const TOOL_NAME_TO_INTENT: Record<ConnectorToolName, ConnectorIntent> = {
  web_search: "web.search",
  web_scrape: "web.scrape",
  web_crawl: "web.crawl",
  notify_email: "notify.email",
  mail_send: "mail.send",
  mail_list: "mail.list",
  script_run: "script.run",
  artifact_upload: "artifact.upload",
  apify_run_actor: "actor.run",
};

export const CONNECTOR_TOOL_NAMES = ["web_search", "web_scrape", "web_crawl", "notify_email", "mail_send", "mail_list", "script_run", "artifact_upload", "apify_run_actor"] as const;
export type ConnectorToolName = (typeof CONNECTOR_TOOL_NAMES)[number];
export type ConnectorProvider = "firecrawl" | "resend" | "agentmail" | "local-script" | "r2" | "apify";
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

export type AgentMailRuntimeConfig = {
  inboxId?: string;
  to?: string | string[];
  subjectPrefix?: string;
  labels?: string[];
  listLimit?: number;
  maxOutputChars?: number;
  timeoutMs?: number;
};

export type ScriptRunRuntimeConfig = {
  agentDir?: string;
  allow?: string[];
  network?: boolean;
  write?: boolean;
  timeoutMs?: number;
  maxOutputChars?: number;
};

export type ArtifactUploadRuntimeConfig = {
  agentDir?: string;
  expiresInSeconds?: number;
  maxFileBytes?: number;
  timeoutMs?: number;
};

export type ApifyRunRuntimeConfig = {
  allow?: string[];
  actor?: string;
  input?: Record<string, unknown>;
  maxOutputItems?: number;
  maxOutputChars?: number;
  timeoutMs?: number;
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
  agentmail?: AgentMailRuntimeConfig;
  script?: ScriptRunRuntimeConfig;
  artifacts?: ArtifactUploadRuntimeConfig;
  apify?: ApifyRunRuntimeConfig;
};

export type ConnectorPlan = ConnectorRuntimeConfig;

export type ConnectorActionRecord = {
  type?: "jumpygoathq_connector_action";
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
  script?: string;
  artifactKey?: string;
  filename?: string;
  bytes?: number;
  expiresAt?: string;
  providerMessageId?: string;
  actorId?: string;
  providerRunId?: string;
  datasetId?: string;
  datasetUrl?: string;
  itemCount?: number;
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
