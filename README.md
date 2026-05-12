# agenthq

Personal scheduled Pi skill runner.

See `docs/ARCHITECTURE.md` for the current concepts and runtime flow. For a server setup with systemd, see `docs/DEPLOY.md`.

## What this is

`automation.md` → `agenthq-runner` → `pi --mode json` → SQLite run history.

No workflow builder. No custom agent loop. Pi is the harness.

## Setup

```bash
pnpm install
pnpm setup:db
pnpm build
pnpm run doctor
```

Pi must also be installed and authenticated/configured. Preferred personal setup is to log into Pi as the same Unix user that will run cron:

```bash
npm install -g @earendil-works/pi-coding-agent
pi /login
pi --mode json --no-session "hello"
```

`.env.local` is optional and gitignored. Use it only for local secrets, environment overrides, or provider keys:

```bash
cp .env.example .env.local
# edit .env.local if needed
```

## Resend email notifications

Notifications are opt-in and skill-decided. The runner sends email only when all are true:

- the skill declares `allowedIntents: [notify.email]`
- the automation enables `notify.email`
- Pi output includes a valid `agenthq-action` block requesting `notify.email`
- Resend sender/recipient/API key config is present

No Resend CLI is required; agenthq calls the Resend HTTP API from the runner.

Configure secrets and optional defaults in `.env.local` or the cron environment:

```bash
RESEND_API_KEY=re_...
AGENTHQ_NOTIFY_EMAIL_TO=you@example.com
AGENTHQ_NOTIFY_EMAIL_FROM="AgentHQ <agent@yourdomain.com>"
AGENTHQ_NOTIFY_SUBJECT_PREFIX="[agenthq] "
```

Per-automation non-secret config lives in frontmatter:

```yaml
notify:
  email:
    enabled: true
    connector: resend
    to: you@example.com
    from: "AgentHQ <agent@yourdomain.com>"
    subjectPrefix: "[daily-review] "
```

For real delivery, verify the `from` domain/address in Resend. Cron jobs must have the same `.env.local` file or exported env vars available.

## Run the sample automation manually

```bash
pnpm runner daily-review
```

Then inspect:

```bash
sqlite3 data/agenthq.sqlite 'select id, automation, status, started_at, duration_ms, connector_actions_json from runs order by started_at desc limit 5;'
sqlite3 data/agenthq.sqlite 'select output_text from runs order by started_at desc limit 1;'
ls workspaces/daily-review
```

## Check the environment

```bash
pnpm run doctor
```

This checks Node, pnpm, Pi, cron, SQLite, and whether Pi auth appears to exist for the current Unix user.

## Run the web viewer

```bash
pnpm web
# open http://127.0.0.1:3000
```

Configuration:

```bash
HOST=127.0.0.1 PORT=3000 pnpm web
```

Default bind is `127.0.0.1` for safety. For Coolify/reverse proxy use, set `HOST=0.0.0.0` only behind trusted auth/proxy/firewall.

The web UI is intentionally raw server-rendered HTML. It shows automations, skills, installed cron entries, runs, run details, and a simple “Run now” button.

## Local validation for coding agents

Use these from the repo root while developing:

```bash
pnpm validate:web       # Playwright smoke checks for the raw HTML web UI
pnpm validate:backend   # runs one Pi-backed smoke automation, default daily-review
pnpm validate           # web smoke, then backend smoke
```

Frontend validation starts the local web server on `127.0.0.1:3123` by default. Install Playwright browsers locally if needed:

```bash
pnpm exec playwright install chromium
```

Backend validation runs exactly one automation and prints the runner stdout/stderr plus the latest run summary, output tail, error tail, and trace tail. It requires local Pi auth/provider setup and may call OpenAI Codex. Override the automation only when intentional:

```bash
AGENTHQ_SMOKE_AUTOMATION=daily-review pnpm validate:backend
```

Common failures:

- Port in use: set `PLAYWRIGHT_PORT=3124 pnpm validate:web`.
- Browser missing: run `pnpm exec playwright install chromium`.
- DB missing: `pnpm validate:backend` runs `pnpm setup:db`; run it manually if you need to inspect setup output.
- Pi auth/provider missing: run `pi /login` and `pnpm doctor`.

## Install as a cron job

Automation schedules are 5-field cron expressions in frontmatter:

```yaml
schedule: "0 9 * * *"
```

Install/update the cron entry:

```bash
pnpm install:cron daily-review
```

List agenthq cron entries:

```bash
pnpm list:cron
```

Remove it:

```bash
pnpm uninstall:cron daily-review
```

Cron logs go to `data/cron-<automation>.log`.

Cron entries export the current `HOME` and `PATH` so Pi can find its stored auth and the `pi` binary. Install cron as the same Unix user that ran `pi /login`.

## Data model

Automations are still files:

- `AGENTS.md` — repo instructions for Pi/agent runs
- `automations/*.md` — scheduled prompt definitions
- `skills/*/SKILL.md` — Pi skills
- `packages/web/` — minimal raw HTML viewer over files, crontab, and SQLite
- `workspaces/<automation>/` — per-automation working dir, gitignored

Past runs are stored in SQLite:

- default DB: `data/agenthq.sqlite`
- override with `AGENTHQ_DB_PATH`
- `data/` is gitignored

Current table:

```sql
runs(
  id text primary key,
  automation text,
  skill text,
  model text,
  schedule text,
  status text,
  started_at text,
  finished_at text,
  duration_ms integer,
  exit_code integer,
  signal text,
  output_text text,
  trace_text text,
  error_text text,
  connector_actions_json text
)
```
