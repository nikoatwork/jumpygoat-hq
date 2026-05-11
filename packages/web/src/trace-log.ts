export type TraceLogEntry = {
  category: "run" | "pi" | "session" | "prompt" | "assistant" | "tool" | "connector" | "stderr" | "error" | "raw";
  label: string;
  detail?: string;
};

type JsonObject = Record<string, unknown>;

export function formatTraceLog(traceText: string): TraceLogEntry[] {
  const entries: TraceLogEntry[] = [];
  const assistantOutputs = new Set<string>();
  const usageEntries = new Set<string>();

  for (const rawLine of traceText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    let event: JsonObject;
    try {
      const parsed = JSON.parse(line);
      if (!isObject(parsed)) throw new Error("not an object");
      event = parsed;
    } catch {
      entries.push({ category: "raw", label: "Malformed trace line", detail: preview(line) });
      continue;
    }

    const type = stringValue(event.type);
    switch (type) {
      case "agenthq_run_meta":
        entries.push({ category: "run", label: "Run metadata", detail: joinDetails([pair("run", event.run_id), pair("automation", event.automation), pair("skill", event.skill), pair("model", event.model), pair("schedule", event.schedule)]) });
        break;
      case "agenthq_pi_start":
        entries.push({ category: "pi", label: "Pi started", detail: joinDetails([pair("command", event.command), pair("cwd", event.cwd), pair("args", Array.isArray(event.args) ? event.args.join(" ") : undefined)]) });
        break;
      case "session":
        entries.push({ category: "session", label: "Session opened", detail: joinDetails([pair("id", event.id), pair("version", event.version), pair("cwd", event.cwd)]) });
        break;
      case "message_start":
        if (roleOf(event.message) === "user") entries.push({ category: "prompt", label: "Prompt sent", detail: preview(textOfMessage(event.message)) });
        break;
      case "tool_execution_start":
        entries.push({ category: "tool", label: "Tool started", detail: toolDetail(event) });
        break;
      case "tool_execution_end":
        entries.push({ category: "tool", label: "Tool finished", detail: toolDetail(event) });
        break;
      case "tool_execution_error":
        entries.push({ category: "error", label: "Tool error", detail: toolDetail(event) });
        break;
      case "tool_execution_update":
        break;
      case "message_update":
        handleMessageUpdate(event, entries, assistantOutputs);
        break;
      case "message_end":
        handleMessageEnd(event, entries, assistantOutputs, usageEntries);
        break;
      case "turn_end":
        handleUsage(event.message, entries, usageEntries);
        break;
      case "agenthq_stderr":
        entries.push({ category: "stderr", label: "stderr", detail: preview(stringValue(event.text)) });
        break;
      case "agenthq_non_json_stdout":
        entries.push({ category: "raw", label: "Non-JSON stdout", detail: preview(stringValue(event.text)) });
        break;
      case "agenthq_connector_plan":
        entries.push({ category: "connector", label: "Connector tools enabled", detail: joinDetails([pair("tools", Array.isArray(event.tools) ? event.tools.join(", ") : undefined), pair("intents", Array.isArray(event.intents) ? event.intents.join(", ") : undefined)]) });
        break;
      case "agenthq_connector_action":
        entries.push({ category: "connector", label: "Connector action", detail: connectorDetail([event]) });
        break;
      case "agenthq_connector_actions":
        entries.push({ category: "connector", label: "Connector actions", detail: connectorDetail(event.actions) });
        break;
      case "agenthq_summary":
        entries.push({ category: "run", label: "Run summary", detail: joinDetails([pair("status", event.status), pair("exit", event.exit_code ?? event.exitCode), pair("duration", durationText(event.duration_ms ?? event.durationMs))]) });
        break;
      case "agenthq_error":
        entries.push({ category: "error", label: "Runner error", detail: preview(stringValue(event.message)) });
        break;
      case "agent_start":
      case "turn_start":
      case "agent_end":
        break;
      default:
        if (type.toLowerCase().includes("tool")) entries.push({ category: "tool", label: type || "Tool event", detail: preview(line) });
        else entries.push({ category: "raw", label: type ? `Unhandled event: ${type}` : "Unhandled trace event", detail: preview(line) });
    }
  }

  return entries;
}

function handleMessageUpdate(event: JsonObject, entries: TraceLogEntry[], emitted: Set<string>): void {
  const update = event.assistantMessageEvent;
  if (!isObject(update) || update.type !== "text_end") return;
  const text = stringValue(update.content) || textOfMessage(update.partial);
  emitAssistant(entries, emitted, responseKey(update.partial, text), text);
}

function handleMessageEnd(event: JsonObject, entries: TraceLogEntry[], emitted: Set<string>, usageEntries: Set<string>): void {
  const message = event.message;
  if (roleOf(message) !== "assistant") return;
  const text = textOfMessage(message);
  emitAssistant(entries, emitted, responseKey(message, text), text);
  handleUsage(message, entries, usageEntries);
}

function emitAssistant(entries: TraceLogEntry[], emitted: Set<string>, key: string, text: string): void {
  if (!text || emitted.has(key)) return;
  emitted.add(key);
  entries.push({ category: "assistant", label: "Assistant output", detail: preview(text) });
}

function handleUsage(message: unknown, entries: TraceLogEntry[], emitted: Set<string>): void {
  if (!isObject(message) || !isObject(message.usage)) return;
  const key = responseKey(message, JSON.stringify(message.usage));
  if (emitted.has(key)) return;
  emitted.add(key);
  const usage = message.usage;
  const cost = isObject(usage.cost) ? usage.cost : undefined;
  entries.push({ category: "assistant", label: "Usage", detail: joinDetails([pair("model", message.model), pair("input", usage.input), pair("output", usage.output), pair("total", usage.totalTokens), pair("cost", cost?.total)]) });
}

function roleOf(message: unknown): string {
  return isObject(message) ? stringValue(message.role) : "";
}

function textOfMessage(message: unknown): string {
  if (!isObject(message) || !Array.isArray(message.content)) return "";
  return message.content.map((part) => (isObject(part) && part.type === "text" ? stringValue(part.text) : "")).join("");
}

function responseKey(value: unknown, fallback: string): string {
  if (isObject(value)) return stringValue(value.responseId) || fallback;
  return fallback;
}

function toolDetail(event: JsonObject): string | undefined {
  return joinDetails([
    pair("tool", event.toolName),
    pair("call", event.toolCallId),
    pair("args", previewJson(event.args)),
    pair("result", previewJson(event.result)),
    pair("error", event.error),
  ]);
}

function connectorDetail(actions: unknown): string {
  if (!Array.isArray(actions) || actions.length === 0) return "none";
  return actions.map((action) => {
    if (!isObject(action)) return preview(String(action));
    return joinDetails([pair("intent", action.intent), pair("status", action.status), pair("to", action.to), pair("id", action.providerMessageId), pair("error", action.error)]);
  }).join("; ");
}

function previewJson(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return preview(value);
  try {
    return preview(JSON.stringify(value));
  } catch {
    return undefined;
  }
}

function pair(label: string, value: unknown): string | undefined {
  const text = stringValue(value);
  return text ? `${label}: ${text}` : undefined;
}

function joinDetails(parts: Array<string | undefined>): string | undefined {
  const kept = parts.filter(Boolean) as string[];
  return kept.length ? kept.join(" · ") : undefined;
}

function durationText(value: unknown): string | undefined {
  if (typeof value !== "number") return undefined;
  return value < 1000 ? `${value}ms` : `${(value / 1000).toFixed(1)}s`;
}

function preview(value: string, max = 220): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function stringValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
