import { clampNumber, connectorSummary, errorMessage, textFromUnknown, truncateText } from "../helpers.js";
import type { ConnectorRuntimeConfig, ConnectorToolDefinition } from "../types.js";
import { listAgentMailMessages, sendAgentMailMessage } from "./client.js";

type AddressParam = string | string[];

type MailSendParams = {
  inboxId?: string;
  to?: AddressParam;
  cc?: AddressParam;
  bcc?: AddressParam;
  replyTo?: AddressParam;
  subject: string;
  text: string;
  html?: string;
  labels?: string[];
};

type MailListParams = {
  inboxId?: string;
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
  maxOutputChars?: number;
};

type AgentMailMessage = Record<string, unknown>;

export function createAgentMailTools(runtime: ConnectorRuntimeConfig): ConnectorToolDefinition[] {
  return [createMailSendTool(runtime), createMailListTool(runtime)];
}

function agentMailDefaults(runtime: ConnectorRuntimeConfig): Required<NonNullable<ConnectorRuntimeConfig["agentmail"]>> {
  return {
    inboxId: runtime.agentmail?.inboxId || "",
    to: runtime.agentmail?.to || "",
    subjectPrefix: runtime.agentmail?.subjectPrefix || "",
    labels: runtime.agentmail?.labels || [],
    listLimit: runtime.agentmail?.listLimit ?? 10,
    maxOutputChars: runtime.agentmail?.maxOutputChars ?? 12_000,
    timeoutMs: runtime.agentmail?.timeoutMs ?? 30_000,
  };
}

function createMailSendTool(runtime: ConnectorRuntimeConfig): ConnectorToolDefinition<MailSendParams> {
  return {
    name: "mail_send",
    label: "Send Mail",
    description: "Send an email from an AgentMail inbox. Requires AGENTMAIL_API_KEY and an inboxId/default inbox.",
    promptSnippet: "Send email through the configured AgentMail inbox",
    promptGuidelines: [
      "Use mail_send only when the automation or agent policy explicitly asks for outbound email.",
      "Include a concise subject and a plain-text body; include html only when useful.",
    ],
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["subject", "text"],
      properties: {
        inboxId: { type: "string", description: "Optional AgentMail inbox ID/address. Defaults to mail.send.inboxId, mail.list.inboxId, or AGENTMAIL_INBOX_ID." },
        to: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }], description: "Recipient address or addresses. Defaults to mail.send.to if configured." },
        cc: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }], description: "Optional CC recipient address(es)." },
        bcc: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }], description: "Optional BCC recipient address(es)." },
        replyTo: { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }], description: "Optional Reply-To address(es)." },
        subject: { type: "string", minLength: 1, description: "Concise email subject, without the configured prefix." },
        text: { type: "string", minLength: 1, description: "Plain-text email body." },
        html: { type: "string", description: "Optional HTML email body." },
        labels: { type: "array", items: { type: "string" }, description: "Optional AgentMail labels for this message." },
      },
    },
    async execute(toolCallId, params, signal) {
      const startedAt = new Date().toISOString();
      const defaults = agentMailDefaults(runtime);
      const inboxId = String(params.inboxId || defaults.inboxId || "").trim();
      const to = normalizeAddress(params.to || defaults.to);
      const subject = `${defaults.subjectPrefix}${params.subject || ""}`.trim();
      const text = (params.text || "").trim();
      const html = typeof params.html === "string" && params.html.trim() ? params.html.trim() : undefined;
      const labels = normalizeLabels(params.labels, defaults.labels);

      try {
        if (!process.env.AGENTMAIL_API_KEY) throw new Error("Missing AGENTMAIL_API_KEY.");
        if (!inboxId) throw new Error("Missing mail.send.inboxId, mail.list.inboxId, or AGENTMAIL_INBOX_ID.");
        if (!to) throw new Error("Missing mail.send.to or mail_send to parameter.");
        if (!subject) throw new Error("mail_send subject is required.");
        if (!text && !html) throw new Error("mail_send text or html is required.");

        const response = await sendAgentMailMessage({
          apiKey: process.env.AGENTMAIL_API_KEY,
          inboxId,
          to,
          cc: normalizeAddress(params.cc),
          bcc: normalizeAddress(params.bcc),
          replyTo: normalizeAddress(params.replyTo),
          subject,
          text,
          html,
          labels,
          timeoutMs: defaults.timeoutMs,
          headers: {
            "X-jumpyGoatHq-Run-Id": runtime.runId,
            "X-jumpyGoatHq-Automation": runtime.automationName,
            "X-jumpyGoatHq-Tool-Call-Id": toolCallId,
          },
          signal,
        });

        const record = asRecord(response);
        const messageId = textFromUnknown(record.message_id ?? record.messageId ?? record.id, 200);
        const threadId = textFromUnknown(record.thread_id ?? record.threadId, 200);
        const finishedAt = new Date().toISOString();
        const summary = connectorSummary({
          runId: runtime.runId,
          automation: runtime.automationName,
          agent: runtime.agentName,
          toolCallId,
          intent: "mail.send",
          toolName: "mail_send",
          connector: "agentmail",
          status: "sent",
          startedAt,
          finishedAt,
          to: Array.isArray(to) ? to.join(", ") : to,
          providerMessageId: messageId,
          resultSummary: { inboxId, subject, textChars: text.length, htmlChars: html?.length, labels, threadId },
        });
        return {
          content: [{ type: "text", text: `AgentMail message sent from ${inboxId} to ${formatAddress(to)}${messageId ? ` (message id: ${messageId})` : ""}.` }],
          details: { connectorSummary: summary },
        };
      } catch (error) {
        const message = errorMessage(error);
        const finishedAt = new Date().toISOString();
        const summary = connectorSummary({
          runId: runtime.runId,
          automation: runtime.automationName,
          agent: runtime.agentName,
          toolCallId,
          intent: "mail.send",
          toolName: "mail_send",
          connector: "agentmail",
          status: "failed",
          startedAt,
          finishedAt,
          to: to ? formatAddress(to) : undefined,
          error: message,
          resultSummary: { inboxId: inboxId || undefined },
        });
        const wrapped = new Error(message) as Error & { connectorSummary?: unknown };
        wrapped.connectorSummary = summary;
        throw wrapped;
      }
    },
  };
}

function createMailListTool(runtime: ConnectorRuntimeConfig): ConnectorToolDefinition<MailListParams> {
  return {
    name: "mail_list",
    label: "List Mail",
    description: "Check/list recent messages in an AgentMail inbox. Requires AGENTMAIL_API_KEY and an inboxId/default inbox.",
    promptSnippet: "Check the configured AgentMail inbox for recent messages",
    promptGuidelines: [
      "Use mail_list when the automation needs to inspect recent inbound/outbound email in the configured inbox.",
      "Use labels, after, before, and limit to keep inbox checks focused.",
    ],
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        inboxId: { type: "string", description: "Optional AgentMail inbox ID/address. Defaults to mail.list.inboxId, mail.send.inboxId, or AGENTMAIL_INBOX_ID." },
        limit: { type: "number", minimum: 1, maximum: 50, description: "Maximum messages to return, max 50." },
        pageToken: { type: "string", description: "Optional next page token from a previous list call." },
        labels: { type: "array", items: { type: "string" }, description: "Optional labels to filter by, e.g. unread or unreplied." },
        before: { type: "string", description: "Optional ISO timestamp: only messages before this time." },
        after: { type: "string", description: "Optional ISO timestamp: only messages after this time." },
        ascending: { type: "boolean", description: "Sort in ascending temporal order." },
        includeSpam: { type: "boolean", description: "Include spam messages." },
        includeBlocked: { type: "boolean", description: "Include blocked messages." },
        includeUnauthenticated: { type: "boolean", description: "Include unauthenticated messages." },
        includeTrash: { type: "boolean", description: "Include trash messages." },
        maxOutputChars: { type: "number", minimum: 1000, maximum: 20000, description: "Optional output bound for this call." },
      },
    },
    async execute(toolCallId, params, signal) {
      const startedAt = new Date().toISOString();
      const defaults = agentMailDefaults(runtime);
      const inboxId = String(params.inboxId || defaults.inboxId || "").trim();
      const limit = clampNumber(params.limit, defaults.listLimit, 1, 50);
      const maxOutputChars = clampNumber(params.maxOutputChars, defaults.maxOutputChars, 1_000, 20_000);
      const labels = normalizeLabels(params.labels, defaults.labels);

      try {
        if (!process.env.AGENTMAIL_API_KEY) throw new Error("Missing AGENTMAIL_API_KEY.");
        if (!inboxId) throw new Error("Missing mail.list.inboxId, mail.send.inboxId, or AGENTMAIL_INBOX_ID.");

        const response = await listAgentMailMessages({
          apiKey: process.env.AGENTMAIL_API_KEY,
          inboxId,
          limit,
          pageToken: params.pageToken,
          labels,
          before: params.before,
          after: params.after,
          ascending: params.ascending,
          includeSpam: params.includeSpam,
          includeBlocked: params.includeBlocked,
          includeUnauthenticated: params.includeUnauthenticated,
          includeTrash: params.includeTrash,
          timeoutMs: defaults.timeoutMs,
          signal,
        });

        const record = asRecord(response);
        const messages = asMessages(record.messages).slice(0, limit);
        const text = formatMessageList(inboxId, record, messages, maxOutputChars);
        const finishedAt = new Date().toISOString();
        const summary = connectorSummary({
          runId: runtime.runId,
          automation: runtime.automationName,
          agent: runtime.agentName,
          toolCallId,
          intent: "mail.list",
          toolName: "mail_list",
          connector: "agentmail",
          status: "succeeded",
          startedAt,
          finishedAt,
          resultSummary: { inboxId, returned: messages.length, count: record.count, limit, labels, hasNextPage: Boolean(record.next_page_token ?? record.nextPageToken) },
        });
        return { content: [{ type: "text", text }], details: { connectorSummary: summary } };
      } catch (error) {
        const message = errorMessage(error);
        const summary = connectorSummary({
          runId: runtime.runId,
          automation: runtime.automationName,
          agent: runtime.agentName,
          toolCallId,
          intent: "mail.list",
          toolName: "mail_list",
          connector: "agentmail",
          status: "failed",
          startedAt,
          finishedAt: new Date().toISOString(),
          error: message,
          resultSummary: { inboxId: inboxId || undefined },
        });
        const wrapped = new Error(message) as Error & { connectorSummary?: unknown };
        wrapped.connectorSummary = summary;
        throw wrapped;
      }
    },
  };
}

function normalizeAddress(value: unknown): AddressParam | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (Array.isArray(value)) {
    const values = value.map((entry) => String(entry || "").trim()).filter(Boolean);
    return values.length ? values : undefined;
  }
  return undefined;
}

function normalizeLabels(value: unknown, fallback: string[] = []): string[] | undefined {
  const source = Array.isArray(value) ? value : fallback;
  const labels = source.map((entry) => String(entry || "").trim()).filter(Boolean).slice(0, 25);
  return labels.length ? labels : undefined;
}

function formatAddress(value: AddressParam): string {
  return Array.isArray(value) ? value.join(", ") : value;
}

function formatMessageList(inboxId: string, response: AgentMailMessage, messages: AgentMailMessage[], maxOutputChars: number): string {
  const count = textFromUnknown(response.count, 50) || String(messages.length);
  const nextPageToken = textFromUnknown(response.next_page_token ?? response.nextPageToken, 500);
  if (!messages.length) return `No AgentMail messages found in ${inboxId}.`;
  const header = [`AgentMail inbox ${inboxId}: ${messages.length} message(s) returned (count: ${count}).`, nextPageToken ? `Next page token: ${nextPageToken}` : undefined].filter(Boolean).join("\n");
  const body = messages.map((message, index) => formatMessageItem(message, index)).join("\n\n");
  return truncateText(`${header}\n\n${body}`, maxOutputChars).text;
}

function formatMessageItem(message: AgentMailMessage, index: number): string {
  const subject = textFromUnknown(message.subject, 300) || "(no subject)";
  const messageId = textFromUnknown(message.message_id ?? message.messageId ?? message.id, 300);
  const threadId = textFromUnknown(message.thread_id ?? message.threadId, 300);
  const from = textFromUnknown(message.from, 500);
  const to = textFromUnknown(message.to, 500);
  const timestamp = textFromUnknown(message.timestamp ?? message.created_at ?? message.createdAt, 200);
  const labels = Array.isArray(message.labels) ? message.labels.map(String).join(", ") : undefined;
  const preview = textFromUnknown(message.extracted_text ?? message.extractedText ?? message.text ?? message.preview ?? message.html, 1200);
  const metadata = [
    messageId ? `id: ${messageId}` : undefined,
    threadId ? `thread: ${threadId}` : undefined,
    from ? `from: ${from}` : undefined,
    to ? `to: ${to}` : undefined,
    timestamp ? `time: ${timestamp}` : undefined,
    labels ? `labels: ${labels}` : undefined,
  ].filter(Boolean);
  return `${index + 1}. ${subject}${metadata.length ? `\n   ${metadata.join("\n   ")}` : ""}${preview ? `\n\n   ${preview}` : ""}`;
}

function asMessages(value: unknown): AgentMailMessage[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function asRecord(value: unknown): AgentMailMessage {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AgentMailMessage) : {};
}
