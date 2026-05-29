import type { ConnectorActionRecord, ConnectorToolName } from "./types.js";
import { isConnectorToolName, TOOL_NAME_TO_INTENT } from "./types.js";

type TraceToolStart = {
  type: "tool_execution_start";
  toolCallId: string;
  toolName: ConnectorToolName;
  args?: unknown;
};

type TraceToolEnd = {
  type: "tool_execution_end";
  toolCallId: string;
  toolName: ConnectorToolName;
  result?: unknown;
  isError?: boolean;
};

export function extractConnectorActionsFromTrace(traceText: string): ConnectorActionRecord[] {
  const starts = new Map<string, ConnectorActionRecord>();
  const completed = new Set<string>();
  const actions: ConnectorActionRecord[] = [];

  for (const line of traceText.split("\n")) {
    if (!line.trim()) continue;
    const event = parseJsonObject(line);
    if (!event) continue;

    if (event.type === "tool_execution_start" && isTraceToolStart(event) && isConnectorToolName(event.toolName)) {
      const started = actionFromStart(event);
      starts.set(event.toolCallId, started);
      continue;
    }

    if (event.type === "tool_execution_end" && isTraceToolEnd(event) && isConnectorToolName(event.toolName)) {
      completed.add(event.toolCallId);
      actions.push(actionFromEnd(event, starts.get(event.toolCallId)));
    }
  }

  for (const [toolCallId, action] of starts) {
    if (!completed.has(toolCallId)) actions.push(action);
  }

  return actions;
}

function actionFromStart(event: TraceToolStart): ConnectorActionRecord {
  const intent = TOOL_NAME_TO_INTENT[event.toolName];
  const args = event.args && typeof event.args === "object" ? (event.args as Record<string, unknown>) : {};
  return {
    intent,
    toolName: event.toolName,
    connector: connectorForTool(event.toolName),
    toolCallId: event.toolCallId,
    status: "started",
    startedAt: new Date().toISOString(),
    query: typeof args.query === "string" ? args.query : undefined,
    url: typeof args.url === "string" ? args.url : undefined,
    to: typeof args.to === "string" ? args.to : undefined,
    script: typeof args.script === "string" ? args.script : undefined,
  };
}

function actionFromEnd(event: TraceToolEnd, start: ConnectorActionRecord | undefined): ConnectorActionRecord {
  const summary = connectorSummaryFromResult(event.result);
  if (summary) {
    return {
      ...start,
      ...summary,
      toolCallId: summary.toolCallId || event.toolCallId,
      toolName: summary.toolName || event.toolName,
      intent: summary.intent || TOOL_NAME_TO_INTENT[event.toolName],
      connector: summary.connector || connectorForTool(event.toolName),
      status: summary.status || (event.isError ? "failed" : "succeeded"),
    };
  }

  return {
    ...start,
    intent: start?.intent || TOOL_NAME_TO_INTENT[event.toolName],
    toolName: event.toolName,
    connector: start?.connector || connectorForTool(event.toolName),
    toolCallId: event.toolCallId,
    status: event.isError ? "failed" : "succeeded",
    error: event.isError ? resultText(event.result) : undefined,
    resultSummary: event.isError ? undefined : { outputChars: resultText(event.result)?.length ?? 0 },
  };
}

function connectorSummaryFromResult(result: unknown): ConnectorActionRecord | undefined {
  if (!result || typeof result !== "object") return undefined;
  const details = (result as { details?: unknown }).details;
  if (!details || typeof details !== "object") return undefined;
  const summary = (details as { connectorSummary?: unknown }).connectorSummary;
  if (!summary || typeof summary !== "object") return undefined;
  return summary as ConnectorActionRecord;
}

function resultText(result: unknown): string | undefined {
  if (!result || typeof result !== "object") return undefined;
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return undefined;
  return content
    .map((entry) => (entry && typeof entry === "object" && "text" in entry ? String((entry as { text: unknown }).text) : ""))
    .filter(Boolean)
    .join("\n")
    .slice(0, 1000);
}

function connectorForTool(toolName: ConnectorToolName): "firecrawl" | "resend" | "agentmail" | "local-script" {
  if (toolName === "notify_email") return "resend";
  if (toolName === "mail_send" || toolName === "mail_list") return "agentmail";
  if (toolName === "script_run") return "local-script";
  return "firecrawl";
}

function parseJsonObject(line: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(line) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function isTraceToolStart(event: Record<string, unknown>): event is TraceToolStart {
  return typeof event.toolCallId === "string" && typeof event.toolName === "string" && isConnectorToolName(event.toolName);
}

function isTraceToolEnd(event: Record<string, unknown>): event is TraceToolEnd {
  return typeof event.toolCallId === "string" && typeof event.toolName === "string" && isConnectorToolName(event.toolName);
}
