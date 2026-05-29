import { fetchWithTimeout, parseResponseBody, responseErrorDetail } from "../helpers.js";

const AGENTMAIL_API_BASE = "https://api.agentmail.to/v0";

type AgentMailAddress = string | string[];

export type AgentMailSendMessageArgs = {
  apiKey: string;
  inboxId: string;
  to: AgentMailAddress;
  subject: string;
  text: string;
  html?: string;
  cc?: AgentMailAddress;
  bcc?: AgentMailAddress;
  replyTo?: AgentMailAddress;
  labels?: string[];
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type AgentMailListMessagesArgs = {
  apiKey: string;
  inboxId: string;
  limit?: number;
  pageToken?: string;
  labels?: string[];
  before?: string;
  after?: string;
  ascending?: boolean;
  includeSpam?: boolean;
  includeBlocked?: boolean;
  includeUnauthenticated?: boolean;
  includeTrash?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export async function sendAgentMailMessage(args: AgentMailSendMessageArgs): Promise<unknown> {
  return await agentMailRequest(`/inboxes/${encodeURIComponent(args.inboxId)}/messages/send`, {
    apiKey: args.apiKey,
    method: "POST",
    body: {
      to: args.to,
      cc: args.cc,
      bcc: args.bcc,
      reply_to: args.replyTo,
      subject: args.subject,
      text: args.text,
      html: args.html,
      labels: args.labels,
      headers: args.headers,
    },
    timeoutMs: args.timeoutMs ?? 30_000,
    signal: args.signal,
  });
}

export async function listAgentMailMessages(args: AgentMailListMessagesArgs): Promise<unknown> {
  const query = new URLSearchParams();
  if (args.limit !== undefined) query.set("limit", String(args.limit));
  if (args.pageToken) query.set("page_token", args.pageToken);
  for (const label of args.labels || []) query.append("labels", label);
  if (args.before) query.set("before", args.before);
  if (args.after) query.set("after", args.after);
  appendBoolean(query, "ascending", args.ascending);
  appendBoolean(query, "include_spam", args.includeSpam);
  appendBoolean(query, "include_blocked", args.includeBlocked);
  appendBoolean(query, "include_unauthenticated", args.includeUnauthenticated);
  appendBoolean(query, "include_trash", args.includeTrash);

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return await agentMailRequest(`/inboxes/${encodeURIComponent(args.inboxId)}/messages${suffix}`, {
    apiKey: args.apiKey,
    method: "GET",
    timeoutMs: args.timeoutMs ?? 30_000,
    signal: args.signal,
  });
}

async function agentMailRequest(path: string, args: {
  apiKey: string;
  method: "GET" | "POST";
  body?: Record<string, unknown>;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<unknown> {
  const response = await fetchWithTimeout(
    `${AGENTMAIL_API_BASE}${path}`,
    {
      method: args.method,
      headers: {
        authorization: `Bearer ${args.apiKey}`,
        "content-type": "application/json",
      },
      body: args.body ? JSON.stringify(pruneUndefined(args.body)) : undefined,
    },
    args.timeoutMs,
    args.signal,
  );

  const body = await parseResponseBody(response);
  if (!response.ok) throw new Error(`AgentMail API ${response.status}: ${responseErrorDetail(body)}`);
  return body;
}

function appendBoolean(query: URLSearchParams, name: string, value: boolean | undefined): void {
  if (typeof value === "boolean") query.set(name, String(value));
}

function pruneUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
