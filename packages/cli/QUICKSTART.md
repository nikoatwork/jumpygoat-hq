# jumpygoathq CLI quickstart

Install from the repo root:

```bash
pnpm --filter @jumpygoat-hq/cli build
pnpm --filter @jumpygoat-hq/cli link --global
```

Start a local API server. The CLI defaults to `http://127.0.0.1:3000`:

```bash
pnpm dev:web
jumpygoathq agents list
jumpygoathq automations list
jumpygoathq runs list --limit 10
jumpygoathq runs view <run-id> --json  # debug output/error/trace
```

Configure/use a remote instance:

```bash
jumpygoathq instances add home --api-url https://hq.example.com --token TOKEN
jumpygoathq instances use home
jumpygoathq instances list
```

Create or update resources (agent/automation markdown can include connector gates such as `script.run` and `scripts.run`):

```bash
jumpygoathq agents apply helper --file ./AGENT.md
jumpygoathq automations apply daily --agent helper --schedule "0 8 * * *" --prompt-file ./prompt.md
jumpygoathq setup automation --file ./setup.yaml --install-cron --run-now
```

Run, schedule, and inspect automations:

```bash
jumpygoathq automations run daily
jumpygoathq cron install-automation daily
jumpygoathq automations status daily --limit 5 --json
jumpygoathq cron status
```

Boards/tasks:

```bash
jumpygoathq boards list
jumpygoathq tasks create --board ops --id first-task --title "Do it" --body "Details"
jumpygoathq tasks status ops first-task --status done
```

Useful flags/env: `--json`, `--api-url URL`, `--instance NAME`, `JUMPYGOATHQ_API_URL`, `JUMPYGOATHQ_TOKEN`.
