# packages/cli

`jumpygoathq` is the command-line client for the jumpyGoatHq JSON API. The CLI does not read or write workspace files directly; all commands call `/api/...` on a local or remote web/API server.

## Local development install

From the repo root:

```bash
pnpm --filter @jumpygoat-hq/cli build
pnpm --filter @jumpygoat-hq/cli link --global
```

This links the local checkout as a global `jumpygoathq` binary. No npm package publish is required.

## API target selection

Start the local API server, then use the CLI. When no API target is configured, the CLI defaults to `http://127.0.0.1:3000`:

```bash
pnpm dev:web
jumpygoathq agents list
jumpygoathq automations run daily
```

For remote/VPS use, pass an API URL/token directly or save a named instance. Named instances are saved API targets in `~/.config/jumpygoathq/config.json`:

```bash
jumpygoathq --api-url https://hq.example.com --token "$JUMPYGOATHQ_API_TOKEN" agents list

jumpygoathq instances add home --api-url https://hq.example.com --token TOKEN
jumpygoathq instances use home
jumpygoathq agents list
jumpygoathq --instance home runs list --limit 10
```

SSH tunnel example:

```bash
ssh -L 3000:127.0.0.1:3000 user@vps
jumpygoathq instances add tunnel --api-url http://127.0.0.1:3000 --token TOKEN
jumpygoathq --instance tunnel agents list
```

Tailscale example:

```bash
jumpygoathq instances add tailnet --api-url http://100.x.y.z:3000 --token TOKEN
jumpygoathq --instance tailnet tasks list
```

`JUMPYGOATHQ_API_URL`, `JUMPYGOATHQ_TOKEN`, and `JUMPYGOATHQ_INSTANCE` are also supported.

## Commands

```bash
jumpygoathq agents list|view|create|update|apply|delete
jumpygoathq automations list|view|create|update|apply|status|delete|run
jumpygoathq boards list|view|create|update|delete
jumpygoathq tasks list|view|create|update|delete|status
jumpygoathq runs list|view
jumpygoathq settings view|update
jumpygoathq cron status|install-automation|uninstall-automation|install-task-heartbeat|uninstall-task-heartbeat
jumpygoathq setup automation
jumpygoathq instances add|list|use|show|remove
```

Use `--json` for machine-readable output.

## Setup/status workflow

Idempotent apply commands are thin wrappers over API endpoints:

```bash
jumpygoathq agents apply news-reporter --file ./AGENT.md
jumpygoathq automations apply daily-product-news \
  --agent news-reporter \
  --schedule "0 8 * * *" \
  --prompt-file ./prompt.md \
  --install-cron
jumpygoathq automations status daily-product-news --limit 5 --json
```

`automations apply` also accepts `--prompt "..."`, `--stdin`, or `--file automation.md|json|yaml`. Markdown files are sent as raw automation markdown; JSON/YAML files can include connector config such as Firecrawl `web.*`, Resend `notify.email`, AgentMail `mail.*`, and local script `scripts.run` blocks.

One-shot setup accepts JSON or YAML:

```bash
jumpygoathq setup automation --file ./setup.yaml --install-cron --run-now --json
```

Example `setup.yaml`:

```yaml
agent:
  name: news-reporter
  content: |
    ---
    name: news-reporter
    description: Finds notable product news and emails a concise digest.
    allowedIntents: [web.search, web.scrape, notify.email]
    ---

    ## Identity

    Report concise, sourced product news.
automation:
  name: daily-product-news
  schedule: "0 8 * * *"
  prompt: Search for notable product/AI developer-tool news from the last day and email a concise digest.
  web:
    search:
      enabled: true
      connector: firecrawl
      limit: 5
    scrape:
      enabled: true
      connector: firecrawl
      maxOutputChars: 12000
  notify:
    email:
      enabled: true
      connector: resend
      to: ops@example.com
      from: jumpyGoatHq <agent@example.com>
      subjectPrefix: "[daily-news]"
```

The backing API primitives are:

- `PUT /api/agents/:name` — create or update an agent bundle.
- `PUT /api/automations/:name` — create or update an automation, preserving connector frontmatter.
- `POST /api/setup/automation` — one-shot agent + automation setup with optional cron install and run-now.
- `GET /api/automations/:name/status?limit=5` — automation metadata, cron evidence, connector summaries, and recent runs.

Troubleshooting:

- If the default local target is unreachable, start `pnpm dev:web`/`pnpm web`, select an instance with `jumpygoathq instances use <name>`, or pass `--api-url`.
- For Tailscale/SSH tunnel setups, verify `curl <api-url>/api` from the same shell before debugging CLI behavior.
- Cron install captures the server-side environment, not the client shell. Ensure `pnpm` is on the server PATH used by the web/API process, then inspect `jumpyGoatHqHome()/data/cron-<automation>.log` if scheduled runs do not fire.
- Resend email notifications need `notify.email.from` in automation frontmatter or `JUMPYGOATHQ_NOTIFY_EMAIL_FROM` on the server, and the sender must be authorized in Resend.
- `script.run` automations need reviewed `.ts`/`.tsx` files under the target agent's `scripts/` folder on the server/workspace; CLI/API calls apply markdown/config but do not upload arbitrary script files unless your bundle process includes them.
