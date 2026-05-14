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
