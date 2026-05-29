import { createAgentMailTools, resolveConnectorPlan } from "../../src/connectors/index.js";
import type { AgentMeta } from "../../src/agent.js";
import type { Automation } from "../../src/automation.js";
import { invocationFromAutomation } from "../../src/invocation.js";
import { boolFlag, bootSmokeScript, flag, main, numberFlag, printHelp, printResult, requireEnv, summarizeToolResult, tool } from "./lib.js";

const HELP = `
AgentMail live connector smoke

Default is safe/read-only: list recent messages from the configured inbox.

Usage:
  pnpm --filter @jumpygoat-hq/runner smoke:agentmail
  pnpm --filter @jumpygoat-hq/runner smoke:agentmail -- --send --to niko@example.com

Flags:
  --inbox-id <id>   Defaults to AGENTMAIL_INBOX_ID
  --limit <n>       List limit, default 1
  --send            Also send one smoke email
  --to <email>      Send recipient, defaults to AGENTMAIL_TO
  --subject <text>  Send subject suffix
  --json            Print full JSON summary
`;

type MailListParams = { inboxId?: string; limit?: number };
type MailSendParams = { inboxId?: string; to?: string; subject: string; text: string };

await main(async () => {
  const flags = bootSmokeScript();
  if (flags.help) return printHelp(HELP);

  requireEnv("AGENTMAIL_API_KEY");
  const inboxId = flag(flags, "inbox-id") || process.env.AGENTMAIL_INBOX_ID;
  if (!inboxId) throw new Error("Missing --inbox-id or AGENTMAIL_INBOX_ID.");
  const limit = numberFlag(flags, "limit", 1);
  const send = boolFlag(flags, "send");
  const to = flag(flags, "to") || process.env.AGENTMAIL_TO;
  if (send && !to) throw new Error("--send requires --to or AGENTMAIL_TO.");

  const automation: Automation = {
    name: "agentmail-smoke",
    agent: "connector-smoke",
    prompt: "AgentMail smoke",
    mail: {
      list: { enabled: true, connector: "agentmail", inboxId, limit },
      send: { enabled: send, connector: "agentmail", inboxId, to },
    },
  };
  const agent: AgentMeta = { name: "connector-smoke", allowedIntents: send ? ["mail.list", "mail.send"] : ["mail.list"] };
  const plan = resolveConnectorPlan({ invocation: invocationFromAutomation(automation), agent, runId: `smoke-agentmail-${Date.now()}` });
  const tools = createAgentMailTools(plan);

  const listResult = await tool<MailListParams>(tools, "mail_list").execute("smoke-list", { inboxId, limit });
  const summary: Record<string, unknown> = {
    connector: "agentmail",
    inboxId,
    listed: summarizeToolResult(listResult),
  };

  if (send) {
    const subject = flag(flags, "subject", `AgentMail connector smoke ${new Date().toISOString()}`)!;
    const text = `jumpyGoatHq AgentMail connector smoke test. Run id: ${plan.runId}. Time: ${new Date().toISOString()}.`;
    const sendResult = await tool<MailSendParams>(tools, "mail_send").execute("smoke-send", { inboxId, to, subject, text });
    summary.sent = summarizeToolResult(sendResult);
  }

  printResult(flags, summary, send ? `AgentMail smoke ok: listed ${inboxId} and sent to ${to}.` : `AgentMail smoke ok: listed ${inboxId}. Add --send --to <email> to test outbound mail.`);
});
