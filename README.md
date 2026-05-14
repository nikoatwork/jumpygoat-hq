# agenthq

Minimal open-source, file-native control plane for Pi-powered agents.

Pre-release note: **agents** are now the user-facing runtime primitive. Breaking changes are acceptable until release. See `docs/vision/strategy/agent.md` and `tasks/vision.md` for the north star, `tasks/spec.md` for the target spec, and `docs/ARCHITECTURE.md` for architecture.

## What this is

Target shape:

```txt
agents as markdown → schedules/tasks/operator commands → Pi runs → auditable SQLite history
```

agenthq aims to be the smallest useful Hermes/OpenClaw-like agent operations layer: strong primitives, limited features, open-source extension seams.

No workflow builder. No broad personal-assistant clone. No custom agent loop. Pi is the harness.

## Setup

```bash
pnpm install
pnpm build
pnpm run doctor
```

This public repo is a template: it ships with no active agents, automations, tasks, or SQLite data. By default mutable instance state lives under local `workspace/` and is gitignored: `workspace/agents/`, `workspace/automations/`, `workspace/projects/`, `workspace/data/`, `workspace/traces/`, and `workspace/workspaces/`. Set `AGENTHQ_HOME=/path/to/agenthq-home` to place that state on an external volume for deployment.

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

Notifications are opt-in and agent-decided. The runner sends email only when all are true:

- the agent declares `allowedIntents: [notify.email]`
- the agent or automation enables `notify.email`
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

Agent connector defaults live in `AGENT.md`; automation frontmatter may override run-specific non-secret config:

```yaml
notify:
  email:
    enabled: true
    connector: resend
    to: you@example.com
    from: "AgentHQ <agent@yourdomain.com>"
    subjectPrefix: "[agenthq] "
```

For real delivery, verify the `from` domain/address in Resend. Cron jobs must have the same `.env.local` file or exported env vars available.

## Create a local automation

Create `workspace/agents/<name>/AGENT.md`, then create an automation that references it:

```md
---
agent: your-agent
schedule: "manual"
---

Your prompt for Pi.
```

Run it manually:

```bash
pnpm runner <automation-name>
```

Run history is created locally under `workspace/data/agenthq.sqlite` and is gitignored. Override the mutable root with `AGENTHQ_HOME`; override only the DB path with `AGENTHQ_DB_PATH` when needed. Relative `AGENTHQ_DB_PATH` values resolve under `AGENTHQ_HOME`.

## Semantic model profiles

Agents and automations may use either a direct Pi model selector or an instance-local profile key such as `fast` or `super-smart` in their optional `model` field. Configure profiles in `agenthqHome()/settings.yml` (default local path: `workspace/settings.yml`) or through `/settings` in the web UI:

```yaml
defaultModelProfile: fast
modelProfiles:
  fast: "provider:fast-model"
  super-smart:
    selector: "provider:smart-model"
    label: "Super smart"
```

Effective model order is automation override, then agent default, then `defaultModelProfile`, then Pi's own default. AgentHQ resolves profile keys before invoking Pi and stores requested/resolved model plus best-effort Pi-emitted usage on run history. Pi remains responsible for provider auth, API keys, custom providers, and whether a concrete selector exists; do not put secrets in `settings.yml`.

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

The web UI is intentionally raw server-rendered HTML. It shows automations, agents, projects/tasks, a kanban board, installed cron entries, runs, run details, and a simple “Run now” button.

## Local validation for coding agents

Use these from the repo root while developing:

```bash
pnpm validate:web       # Playwright smoke checks for the raw HTML web UI
pnpm validate:backend   # creates/runs one temporary Pi-backed smoke automation
pnpm validate           # web smoke, then backend smoke
```

Frontend validation starts the local web server on `127.0.0.1:3123` by default. Install Playwright browsers locally if needed:

```bash
pnpm exec playwright install chromium
```

Backend validation runs exactly one automation and prints the runner stdout/stderr plus the latest run summary, output tail, error tail, and trace tail. By default it creates a temporary gitignored `agenthq-smoke` agent/automation if needed, runs it, and removes the fixture. It requires local Pi auth/provider setup and may call OpenAI Codex. Override the automation only when intentional:

```bash
AGENTHQ_SMOKE_AUTOMATION=<automation-name> pnpm validate:backend
```

Common failures:

- Port in use: set `PLAYWRIGHT_PORT=3124 pnpm validate:web`.
- Browser missing: run `pnpm exec playwright install chromium`.
- DB missing: `pnpm validate:backend` runs `pnpm setup:db`; run it manually if you need to inspect setup output.
- Pi auth/provider missing: run `pi /login` and `pnpm run doctor`.

## Dispatch assigned tasks

Create projects and tasks under `workspace/projects/` or through the web UI. Tasks with `status: ready` and a valid `assignee` are claimed by the heartbeat dispatcher:

```bash
pnpm dispatch:tasks          # claims one ready task
pnpm dispatch:tasks --limit=3 # optional small local batch
```

The dispatcher records a normal SQLite run row with `project` and `task_id`, transitions successful runs to `review`, and marks failed runs `failed` with dispatch notes.

## Install as a cron job

Automation schedules are 5-field cron expressions in frontmatter:

```yaml
schedule: "0 9 * * *"
```

Install/update the cron entry:

```bash
pnpm install:cron <automation-name>
```

List agenthq cron entries:

```bash
pnpm list:cron
```

Remove it:

```bash
pnpm uninstall:cron <automation-name>
```

Cron logs go to `workspace/data/cron-<automation>.log` by default, or `$AGENTHQ_HOME/data/cron-<automation>.log` when `AGENTHQ_HOME` is set.

Cron entries export the current `HOME` and `PATH` so Pi can find its stored auth and the `pi` binary. Install cron as the same Unix user that ran `pi /login`.

## Data model

- `AGENTS.md` — repo instructions for coding agents working on this project
- `workspace/agents/*/AGENT.md` — AgentHQ agents, local/gitignored by default
- `workspace/agents/*/context/*.md` — optional scoped agent context
- `workspace/automations/*.md` — scheduled/manual prompt definitions, local/gitignored by default
- `workspace/projects/<project>/PROJECT.md` and `tasks/*.md` — project/task kanban source of truth, active state local/gitignored by default
- `workspace/settings.yml` — optional instance-local model profile settings, gitignored by default
- `packages/web/` — minimal raw HTML viewer over files, crontab, and SQLite
- `workspace/workspaces/<automation>/` — per-automation Pi working dir, gitignored
- `workspace/traces/` — optional trace artifacts, gitignored

Past runs are stored in SQLite:

- default DB: `workspace/data/agenthq.sqlite`
- mutable root override: `AGENTHQ_HOME=/path/to/agenthq-home`
- explicit DB override: `AGENTHQ_DB_PATH` (relative paths resolve under `AGENTHQ_HOME`)
- runtime workspace directories are gitignored

Current table:

```sql
runs(
  id text primary key,
  automation text,
  source_type text,
  source_id text,
  agent text,
  project text,
  task_id text,
  model text,
  requested_model text,
  resolved_model text,
  model_profile text,
  model_resolution_warning text,
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
  connector_actions_json text,
  usage_input_tokens integer,
  usage_output_tokens integer,
  usage_reasoning_tokens integer,
  usage_cache_read_tokens integer,
  usage_cache_write_tokens integer,
  usage_total_tokens integer,
  usage_cost_total real,
  usage_currency text,
  usage_provider text,
  usage_model text,
  usage_json text
)
```
