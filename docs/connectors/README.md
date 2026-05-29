# Connectors

Connectors are optional jumpyGoatHq adapters that expose external services to Pi as gated, run-scoped tools. They are how automations search the web, send notifications, send email, or check inboxes without giving agents arbitrary shell/API access.

## How connector setup works

Every connector tool requires two gates:

1. The agent `AGENT.md` includes the provider-neutral intent in `allowedIntents`.
2. The agent defaults or automation/task frontmatter enables the connector config for that run.

Secrets stay in `.env.local`, deployment secrets, or cron environment. Do not put API keys in agent or automation markdown.

## Available connectors

| Connector | Intents | Tools | Setup doc |
| --- | --- | --- | --- |
| Firecrawl | `web.search`, `web.scrape`, `web.crawl` | `web_search`, `web_scrape`, `web_crawl` | [`firecrawl.md`](firecrawl.md) |
| Resend | `notify.email` | `notify_email` | [`resend.md`](resend.md) |
| AgentMail | `mail.send`, `mail.list` | `mail_send`, `mail_list` | [`agentmail.md`](agentmail.md) |
| Local Script | `script.run` | `script_run` | [`script-run.md`](script-run.md) |
| Cloudflare R2 Artifacts | `artifact.upload` | `artifact_upload` | [`r2-artifacts.md`](r2-artifacts.md) |

## Check local configuration

Run:

```bash
pnpm run doctor
```

Connector checks are informational. Optional connectors that are not configured do not make doctor fail. Partial connector config prints warnings so you know what is still needed before enabling that connector in an agent/automation.

## Live smoke scripts

For quick end-to-end connector revalidation without hand-writing temporary automations, use the runner smoke scripts. They load `.env.local`/`.env`, build an in-memory automation + agent, resolve connector gates, and execute the real connector tool:

```bash
pnpm smoke:firecrawl
pnpm smoke:agentmail
pnpm smoke:agentmail -- --send --to niko@example.com
pnpm smoke:resend -- --send --to niko@example.com --from "jumpyGoatHq <agent@example.com>"
pnpm smoke:script-run
```

R2 artifact links are covered by connector tests and `pnpm run doctor`; a live upload smoke can be added once a disposable test bucket convention exists.

See `packages/runner/scripts/connectors/README.md` for flags and safety notes. AgentMail and Firecrawl have safe read-only defaults; Resend and outbound AgentMail sends require explicit send flags.
