# packages/cli

`jumpygoathq` is the command-line adapter for jumpyGoatHQ CRUD operations.

## Local development install

From the repo root:

```bash
pnpm --filter @jumpygoat-hq/cli build
pnpm --filter @jumpygoat-hq/cli link --global
```

This links the local checkout as a global `jumpygoathq` binary. No npm package publish is required.

## Modes

Local mode is the default when no API URL or instance profile is selected. It calls `@jumpygoat-hq/core` directly and operates on the local `JUMPYGOATHQ_HOME`.

```bash
jumpygoathq agents list
jumpygoathq automations run daily
```

Remote mode uses the hosted JSON API. When the server has `JUMPYGOATHQ_API_TOKEN` set, pass the matching token with `--token`, `JUMPYGOATHQ_TOKEN`, or a named instance profile:

```bash
jumpygoathq --api-url https://hq.example.com --token "$JUMPYGOATHQ_API_TOKEN" agents list
```

Named per-instance profiles live in `~/.config/jumpygoathq/config.json` by default:

```bash
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
jumpygoathq agents list|view|create|update|delete
jumpygoathq automations list|view|create|update|delete|run
jumpygoathq boards list|view|create|update|delete
jumpygoathq tasks list|view|create|update|delete|status
jumpygoathq runs list|view
jumpygoathq settings view|update
jumpygoathq cron status|install-automation|uninstall-automation|install-task-heartbeat|uninstall-task-heartbeat
jumpygoathq instances add|list|use|show|remove
```

Use `--json` for machine-readable output.

## Setup/status workflow

The JSON API now supports idempotent setup primitives:

- `PUT /api/agents/:name` — create or update an agent bundle.
- `PUT /api/automations/:name` — create or update an automation, preserving connector frontmatter such as Firecrawl `web.*` and Resend `notify.email` blocks.
- `POST /api/setup/automation` — one-shot agent + automation setup with optional cron install and run-now.
- `GET /api/automations/:name/status?limit=5` — automation metadata, cron evidence, connector summaries, and recent runs.

Dedicated CLI wrappers are tracked in `tasks/todo/tasks-cli-api-agent-automation-setup.md` task 6.0 (`agents apply`, `automations apply`, `setup automation`, and `automations status`). Until those commands land, use `packages/web/DOCS.md` curl examples for one-shot setup/status, or use the existing CRUD commands for local manual flows:

```bash
jumpygoathq agents create news-reporter --file ./AGENT.md
jumpygoathq automations create daily-product-news --agent news-reporter --schedule "0 8 * * *" --prompt "Search and summarize product news."
jumpygoathq automations run daily-product-news
jumpygoathq cron install-automation daily-product-news
jumpygoathq cron status --json
```

Remote troubleshooting:

- If the default instance is unreachable, run `jumpygoathq instances list` and `jumpygoathq instances show`; switch with `jumpygoathq instances use <name>` or override with `--api-url`.
- For Tailscale/SSH tunnel setups, verify `curl <api-url>/api` from the same shell before debugging CLI behavior.
- Cron install captures the server-side environment, not the client shell. Ensure `pnpm` is on the server PATH used by the web/API process, then inspect `jumpyGoatHqHome()/data/cron-<automation>.log` if scheduled runs do not fire.
- Resend email notifications need `notify.email.from` in automation frontmatter or `JUMPYGOATHQ_NOTIFY_EMAIL_FROM` on the server, and the sender must be authorized in Resend.
