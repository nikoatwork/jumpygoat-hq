export type ResourceMeta = {
  path?: string;
  updatedAt?: string;
  etag?: string;
  warning?: string;
};

export type RawMarkdownResource = ResourceMeta & {
  rawMarkdown?: string;
};

export type AgentDto = RawMarkdownResource & {
  name: string;
  description: string;
  contextCount: number;
};

export type AutomationDto = RawMarkdownResource & {
  name: string;
  agent: string;
  schedule: string;
  model: string;
  web?: unknown;
  notify?: unknown;
  mail?: unknown;
  scripts?: unknown;
  prompt: string;
  promptPreview: string;
};

export type BoardDto = RawMarkdownResource & {
  id: string;
  name: string;
  description: string;
  defaultAgent?: string;
  taskCount?: number;
  body: string;
};

export type TaskStatus = "not-yet" | "ready" | "working-on-it" | "done";

export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type TaskDto = RawMarkdownResource & {
  id: string;
  title: string;
  board: string;
  status: TaskStatus;
  assignee: string;
  priority: TaskPriority;
  createdAt: string;
  updatedAt: string;
  claimedAt?: string;
  runId?: string;
  attempts: number;
  body: string;
};

export type SettingsDto = ResourceMeta & {
  exists: boolean;
  content: string;
  settings?: unknown;
};

export type RunDto = {
  id: string;
  automation: string;
  sourceType?: string | null;
  sourceId?: string | null;
  agent?: string | null;
  model?: string | null;
  requestedModel?: string | null;
  resolvedModel?: string | null;
  modelProfile?: string | null;
  modelResolutionWarning?: string | null;
  schedule?: string | null;
  status: string;
  startedAt: string;
  finishedAt?: string | null;
  durationMs?: number | null;
  exitCode?: number | null;
  signal?: string | null;
  outputText: string;
  traceText: string;
  errorText: string;
  connectorActionsJson?: string | null;
  board?: string | null;
  taskId?: string | null;
  usage?: Record<string, unknown> | null;
};

export type CronBlockDto = {
  name: string;
  block: string;
  line: string;
  warning?: string;
};

export type TaskHeartbeatCronStatusDto = {
  installed: boolean;
  block: string;
  line: string;
  warning?: string;
};

export type CronStatusDto = {
  automations: CronBlockDto[];
  taskHeartbeat: TaskHeartbeatCronStatusDto;
};

export type ListOptions = {
  includeRaw?: boolean;
};

export type RevisionPrecondition = {
  ifMatch?: string;
};
