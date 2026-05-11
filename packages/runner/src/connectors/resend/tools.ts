import { connectorSummary, errorMessage } from "../helpers.js";
import type { ConnectorRuntimeConfig, ConnectorToolDefinition } from "../types.js";
import { sendResendEmail } from "./client.js";

type NotifyEmailParams = {
  subject: string;
  body: string;
  to?: string;
  from?: string;
};

export function createResendTools(runtime: ConnectorRuntimeConfig): ConnectorToolDefinition[] {
  return [createNotifyEmailTool(runtime)];
}

function createNotifyEmailTool(runtime: ConnectorRuntimeConfig): ConnectorToolDefinition<NotifyEmailParams> {
  return {
    name: "notify_email",
    label: "Notify Email",
    description: "Send one email notification through the configured Resend connector. Requires subject and body; uses automation defaults for to/from unless supplied.",
    promptSnippet: "Send a gated email notification through Resend",
    promptGuidelines: [
      "Use notify_email only when the skill instructions say an email notification is warranted.",
      "Do not call notify_email for routine FYI-only summaries or duplicate notifications.",
    ],
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["subject", "body"],
      properties: {
        subject: { type: "string", minLength: 1, description: "Concise email subject, without the configured prefix." },
        body: { type: "string", minLength: 1, description: "Plain-text email body." },
        to: { type: "string", description: "Optional recipient override. Defaults to automation/env config." },
        from: { type: "string", description: "Optional sender override. Defaults to automation/env config." },
      },
    },
    async execute(toolCallId, params, signal) {
      const startedAt = new Date().toISOString();
      const to = (params.to || runtime.resend?.to || "").trim();
      const from = (params.from || runtime.resend?.from || "").trim();
      const subject = `${runtime.resend?.subjectPrefix || ""}${params.subject || ""}`.trim();
      const body = (params.body || "").trim();

      try {
        if (!process.env.RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY.");
        if (!to) throw new Error("Missing notify.email.to or AGENTHQ_NOTIFY_EMAIL_TO.");
        if (!from) throw new Error("Missing notify.email.from or AGENTHQ_NOTIFY_EMAIL_FROM.");
        if (!subject) throw new Error("notify_email subject is required.");
        if (!body) throw new Error("notify_email body is required.");

        const providerMessageId = await sendResendEmail({
          apiKey: process.env.RESEND_API_KEY,
          from,
          to,
          subject,
          body,
          timeoutMs: 30_000,
          idempotencyKey: `agenthq:${runtime.runId}:${toolCallId}`,
          headers: {
            "X-AgentHQ-Run-Id": runtime.runId,
            "X-AgentHQ-Automation": runtime.automationName,
            "X-AgentHQ-Tool-Call-Id": toolCallId,
          },
          signal,
        });

        const finishedAt = new Date().toISOString();
        const summary = connectorSummary({
          runId: runtime.runId,
          automation: runtime.automationName,
          skill: runtime.skillName,
          toolCallId,
          intent: "notify.email",
          toolName: "notify_email",
          connector: "resend",
          status: "sent",
          startedAt,
          finishedAt,
          to,
          providerMessageId,
          resultSummary: { subject, bodyChars: body.length },
        });
        return {
          content: [{ type: "text", text: `Email sent to ${to}${providerMessageId ? ` (message id: ${providerMessageId})` : ""}.` }],
          details: { connectorSummary: summary },
        };
      } catch (error) {
        const message = errorMessage(error);
        const finishedAt = new Date().toISOString();
        const summary = connectorSummary({
          runId: runtime.runId,
          automation: runtime.automationName,
          skill: runtime.skillName,
          toolCallId,
          intent: "notify.email",
          toolName: "notify_email",
          connector: "resend",
          status: "failed",
          startedAt,
          finishedAt,
          to: to || undefined,
          error: message,
        });
        const wrapped = new Error(message) as Error & { connectorSummary?: unknown };
        wrapped.connectorSummary = summary;
        throw wrapped;
      }
    },
  };
}
