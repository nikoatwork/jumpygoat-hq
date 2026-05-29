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

## Check local configuration

Run:

```bash
pnpm run doctor
```

Connector checks are informational. Optional connectors that are not configured do not make doctor fail. Partial connector config prints warnings so you know what is still needed before enabling that connector in an agent/automation.
