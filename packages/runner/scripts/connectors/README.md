# Live connector smoke scripts

These scripts make it quick to revalidate connector wiring without creating temporary automations by hand. They load `.env.local`/`.env`, build a tiny in-memory automation + agent, pass it through `invocationFromAutomation()` and `resolveConnectorPlan()`, then execute the real connector tool. That means they catch both provider/API failures and runner connector-plumbing regressions.

Run from the repo root with `pnpm --filter @jumpygoat-hq/runner <script>`.

## Firecrawl

Read-only by default:

```bash
pnpm --filter @jumpygoat-hq/runner smoke:firecrawl
pnpm --filter @jumpygoat-hq/runner smoke:firecrawl -- --query "jumpyGoatHq GitHub" --limit 2 --json
```

Optional scrape:

```bash
pnpm --filter @jumpygoat-hq/runner smoke:firecrawl -- --scrape-url https://example.com
```

Requires `FIRECRAWL_API_KEY`.

## AgentMail

Read-only by default: lists recent messages from `AGENTMAIL_INBOX_ID`.

```bash
pnpm --filter @jumpygoat-hq/runner smoke:agentmail
pnpm --filter @jumpygoat-hq/runner smoke:agentmail -- --inbox-id cronos@agentmail.to --json
```

Outbound send requires an explicit flag:

```bash
pnpm --filter @jumpygoat-hq/runner smoke:agentmail -- --send --to niko@example.com
```

Requires `AGENTMAIL_API_KEY` and `AGENTMAIL_INBOX_ID` unless `--inbox-id` is supplied.

## Resend

Resend has no safe read-only connector endpoint here, so the smoke requires `--send`.

```bash
pnpm --filter @jumpygoat-hq/runner smoke:resend -- \
  --send \
  --to niko@example.com \
  --from "jumpyGoatHq <agent@example.com>"
```

Requires `RESEND_API_KEY`; `--to`/`--from` may default to `JUMPYGOATHQ_NOTIFY_EMAIL_TO` and `JUMPYGOATHQ_NOTIFY_EMAIL_FROM`.

## local script.run

Creates and deletes a temporary agent script, then executes it through `script_run`:

```bash
pnpm --filter @jumpygoat-hq/runner smoke:script-run
```
