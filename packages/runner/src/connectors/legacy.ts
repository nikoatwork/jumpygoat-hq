import type { AgentMeta } from "../agent.js";
import type { Automation, ConnectorOverrides } from "../automation.js";
import { sendResendEmail } from "./resend/index.js";
import type { ConnectorActionRecord, ConnectorIntent } from "./types.js";

type ParsedNotification =
  | { kind: "none" }
  | { kind: "malformed"; error: string }
  | { kind: "action"; action: EmailNotificationAction };

type EmailNotificationAction = {
  type: "notify.email";
  subject: string;
  body: string;
};

type EmailConfig = {
  enabled: boolean;
  connector: "resend";
  to?: string;
  from?: string;
  subjectPrefix?: string;
};

export async function processLegacyConnectorActions(args: {
  automation: Automation;
  agent: AgentMeta;
  outputText: string;
  runSucceeded: boolean;
  alreadyHandledIntents?: Set<ConnectorIntent | string>;
}): Promise<ConnectorActionRecord[]> {
  const parsed = parseNotificationAction(args.outputText);
  if (parsed.kind === "none") return [];

  if (parsed.kind === "malformed") {
    return [{ intent: "notify.email", status: "skipped_malformed", error: parsed.error }];
  }

  const action = parsed.action;
  if (args.alreadyHandledIntents?.has(action.type)) {
    return [{ intent: action.type, status: "skipped_tool_already_used" }];
  }
  if (!args.runSucceeded) {
    return [{ intent: action.type, status: "skipped_run_failed" }];
  }
  if (!args.agent.allowedIntents.includes(action.type)) {
    return [{ intent: action.type, status: "skipped_not_allowed" }];
  }

  const config = resolveEmailConfig(args.agent, args.automation);
  if (!config.enabled) return [{ intent: action.type, connector: config.connector, status: "skipped_disabled" }];
  if (!config.to) return [{ intent: action.type, connector: config.connector, status: "failed_missing_config", error: "Missing notify.email.to or AGENTHQ_NOTIFY_EMAIL_TO." }];
  if (!config.from) return [{ intent: action.type, connector: config.connector, to: config.to, status: "failed_missing_config", error: "Missing notify.email.from or AGENTHQ_NOTIFY_EMAIL_FROM." }];
  if (!process.env.RESEND_API_KEY) return [{ intent: action.type, connector: config.connector, to: config.to, status: "failed_missing_config", error: "Missing RESEND_API_KEY." }];

  try {
    const providerMessageId = await sendResendEmail({
      apiKey: process.env.RESEND_API_KEY,
      from: config.from,
      to: config.to,
      subject: `${config.subjectPrefix || ""}${action.subject}`,
      body: action.body,
      headers: { "X-AgentHQ-Legacy-Action": "true" },
    });
    return [{ intent: action.type, connector: config.connector, to: config.to, status: "sent", providerMessageId }];
  } catch (error) {
    return [{ intent: action.type, connector: config.connector, to: config.to, status: "failed_delivery", error: error instanceof Error ? error.message : String(error) }];
  }
}

export function parseNotificationAction(outputText: string): ParsedNotification {
  const match = outputText.match(/```(?:agenthq-action|agenthq-notification)\s*\n([\s\S]*?)\n```/);
  if (!match) return { kind: "none" };

  try {
    const parsed = JSON.parse(match[1] || "") as { type?: unknown; notify?: unknown; subject?: unknown; body?: unknown };
    const type = parsed.type || (parsed.notify === true ? "notify.email" : undefined);
    if (type !== "notify.email") throw new Error("Notification action type must be notify.email.");
    if (typeof parsed.subject !== "string" || !parsed.subject.trim()) throw new Error("Notification action requires a non-empty subject string.");
    if (typeof parsed.body !== "string" || !parsed.body.trim()) throw new Error("Notification action requires a non-empty body string.");
    return { kind: "action", action: { type, subject: parsed.subject.trim(), body: parsed.body.trim() } };
  } catch (error) {
    return { kind: "malformed", error: error instanceof Error ? error.message : String(error) };
  }
}

function resolveEmailConfig(agent: ConnectorOverrides, automation: ConnectorOverrides): EmailConfig {
  const email = { ...(agent.notify?.email || {}), ...(automation.notify?.email || {}) };
  return {
    enabled: email.enabled === true,
    connector: "resend",
    to: email.to || process.env.AGENTHQ_NOTIFY_EMAIL_TO,
    from: email.from || process.env.AGENTHQ_NOTIFY_EMAIL_FROM,
    subjectPrefix: email.subjectPrefix ?? process.env.AGENTHQ_NOTIFY_SUBJECT_PREFIX ?? "",
  };
}
