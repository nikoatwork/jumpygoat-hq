import type { ConnectorActionRecord, ConnectorIntent, ConnectorProvider, ConnectorToolName } from "./types.js";

export function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(numeric)));
}

export function requireHttpUrl(value: string, label = "url"): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label} must use http or https: ${value}`);
  }
  return parsed;
}

export function truncateText(value: string, maxChars: number): { text: string; truncated: boolean; originalChars: number } {
  if (value.length <= maxChars) return { text: value, truncated: false, originalChars: value.length };
  const suffix = `\n\n[truncated ${value.length - maxChars} chars from connector output]`;
  const keep = Math.max(0, maxChars - suffix.length);
  return { text: value.slice(0, keep).trimEnd() + suffix, truncated: true, originalChars: value.length };
}

export function textFromUnknown(value: unknown, maxChars: number): string | undefined {
  if (typeof value === "string") return truncateText(value, maxChars).text;
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return truncateText(JSON.stringify(value), maxChars).text;
  } catch {
    return String(value);
  }
}

export function connectorSummary(args: {
  runId?: string;
  automation?: string;
  agent?: string;
  toolCallId: string;
  intent: ConnectorIntent;
  toolName: ConnectorToolName;
  connector: ConnectorProvider;
  status: ConnectorActionRecord["status"];
  startedAt: string;
  finishedAt?: string;
  to?: string;
  url?: string;
  query?: string;
  providerMessageId?: string;
  resultSummary?: Record<string, unknown>;
  error?: string;
}): ConnectorActionRecord {
  return {
    type: "agenthq_connector_action",
    runId: args.runId,
    automation: args.automation,
    agent: args.agent,
    toolCallId: args.toolCallId,
    intent: args.intent,
    toolName: args.toolName,
    connector: args.connector,
    status: args.status,
    startedAt: args.startedAt,
    finishedAt: args.finishedAt,
    durationMs: args.finishedAt ? Math.max(0, Date.parse(args.finishedAt) - Date.parse(args.startedAt)) : undefined,
    to: args.to,
    url: args.url,
    query: args.query,
    providerMessageId: args.providerMessageId,
    resultSummary: args.resultSummary,
    error: args.error,
  };
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
  const onAbort = (): void => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener("abort", onAbort);
  }
}

export async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function responseErrorDetail(body: unknown): string {
  if (typeof body === "string") return body;
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.error === "string") return record.error;
    if (typeof record.message === "string") return record.message;
  }
  return body === undefined ? "empty response" : JSON.stringify(body);
}
