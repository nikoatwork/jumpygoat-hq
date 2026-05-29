import { createResendTools, resolveConnectorPlan } from "../../src/connectors/index.js";
import type { AgentMeta } from "../../src/agent.js";
import type { Automation } from "../../src/automation.js";
import { invocationFromAutomation } from "../../src/invocation.js";
import { boolFlag, bootSmokeScript, flag, main, printHelp, printResult, requireEnv, summarizeToolResult, tool } from "./lib.js";

const HELP = `
Resend live connector smoke

Resend has no safe read-only connector path, so this script requires --send.

Usage:
  pnpm --filter @jumpygoat-hq/runner smoke:resend -- --send --to niko@example.com --from "jumpyGoatHq <agent@example.com>"

Flags:
  --send            Required; send one smoke email
  --to <email>      Defaults to JUMPYGOATHQ_NOTIFY_EMAIL_TO
  --from <email>    Defaults to JUMPYGOATHQ_NOTIFY_EMAIL_FROM
  --subject <text>  Subject suffix
  --json            Print full JSON summary
`;

type NotifyEmailParams = { to?: string; from?: string; subject: string; body: string };

await main(async () => {
  const flags = bootSmokeScript();
  if (flags.help) return printHelp(HELP);

  requireEnv("RESEND_API_KEY");
  if (!boolFlag(flags, "send")) throw new Error("Resend smoke would send email. Re-run with --send --to <email> --from <authorized sender>.");
  const to = flag(flags, "to") || process.env.JUMPYGOATHQ_NOTIFY_EMAIL_TO;
  const from = flag(flags, "from") || process.env.JUMPYGOATHQ_NOTIFY_EMAIL_FROM;
  if (!to) throw new Error("Missing --to or JUMPYGOATHQ_NOTIFY_EMAIL_TO.");
  if (!from) throw new Error("Missing --from or JUMPYGOATHQ_NOTIFY_EMAIL_FROM.");

  const automation: Automation = {
    name: "resend-smoke",
    agent: "connector-smoke",
    prompt: "Resend smoke",
    notify: { email: { enabled: true, connector: "resend", to, from, subjectPrefix: "[jumpyGoatHq smoke] " } },
  };
  const agent: AgentMeta = { name: "connector-smoke", allowedIntents: ["notify.email"] };
  const plan = resolveConnectorPlan({ invocation: invocationFromAutomation(automation), agent, runId: `smoke-resend-${Date.now()}` });
  const tools = createResendTools(plan);
  const subject = flag(flags, "subject", `Resend connector smoke ${new Date().toISOString()}`)!;
  const body = `jumpyGoatHq Resend connector smoke test. Run id: ${plan.runId}. Time: ${new Date().toISOString()}.`;
  const result = await tool<NotifyEmailParams>(tools, "notify_email").execute("smoke-resend", { to, from, subject, body });
  const summary = { connector: "resend", sent: summarizeToolResult(result) };

  printResult(flags, summary, `Resend smoke ok: sent to ${to}.`);
});
