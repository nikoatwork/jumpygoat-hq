---
STATUS: COMPLETED
COMPLETED_DATE: 2026-05-08
FEATURE: local-pi-backed-mvp
---

# Task 01 — Local Pi-backed MVP

## Context

agenthq is a **personal scheduled Pi skill runner**, not a custom agent platform.

Core flow:

```txt
automation markdown file -> agenthq-runner -> pi --mode json -> SQLite runs row
```

No custom LLM loop. No Vercel AI SDK. No MCP. No multi-user dashboard. Pi is the harness.

## Current data structure

Automation files:

```ts
type Automation = {
  name: string;
  skill: string;
  schedule?: string;
  model?: string;
  prompt: string;
}
```

Run storage: SQLite table `runs` in `data/agenthq.sqlite` by default.

```sql
runs(
  id text primary key,
  automation text not null,
  skill text not null,
  model text,
  schedule text,
  status text not null,
  started_at text not null,
  finished_at text,
  duration_ms integer,
  exit_code integer,
  signal text,
  output_text text not null default '',
  trace_text text not null default '',
  error_text text not null default ''
)
```

## TL;DR

**Completed:** 2026-05-08

**What we built:**
- Built a TypeScript runner that executes Pi skills from automation markdown files.
- Added SQLite run storage, optional `.env`, Pi-login-first auth checks, and cron install scripts.
- Added sample `daily-review` skill/automation and repo setup scripts.

**What changed along the way:**
- Reframed scope toward personal scheduled Pi skills, SQLite run history, and minimal raw HTML observability.

**Skipped/Deferred:**
- Live Pi/model smoke test was intentionally skipped to avoid spending tokens without explicit confirmation.


## Tasks

- [x] 1.0 Bootstrap minimal repo
  - [x] package scripts / pnpm workspace / TS config
  - [x] `packages/runner/`
  - [x] `automations/`, `skills/`, `workspaces/`, `data/`
  - [x] `.gitignore` includes `.env`, `data/`, `workspaces/`
  - [x] `.env.example` documents provider key and DB path

- [x] 2.0 Automation parser
  - [x] Parse `automations/<name>.md` with `gray-matter`
  - [x] Zod schema: `skill`, optional `schedule`, optional `model`
  - [x] Return `{ name, skill, model, schedule, prompt }`
  - [x] Fail clearly on missing file, invalid frontmatter, empty prompt

- [x] 3.0 SQLite setup
  - [x] Add `better-sqlite3`
  - [x] Add `packages/runner/src/db.ts`
  - [x] Add `pnpm setup:db`
  - [x] DB path defaults to `data/agenthq.sqlite`
  - [x] DB path can be overridden with `AGENTHQ_DB_PATH`

- [x] 4.0 Auth/environment loading
  - [x] Add `dotenv`
  - [x] Runner imports `dotenv/config`
  - [x] `.env` remains gitignored and optional
  - [x] Prefer Pi stored login via `pi /login`
  - [x] Add `pnpm run doctor` to check Pi/auth/cron/SQLite

- [x] 5.0 Pi runner wrapper
  - [x] Resolve `skills/<skill>/SKILL.md`
  - [x] Spawn `pi --mode json --no-session --skill <path>`
  - [x] Add `--model` when automation specifies one
  - [x] Pass prompt as CLI argument
  - [x] Use `workspaces/<automation>/` as cwd
  - [x] Collect raw Pi JSON lines as text trace
  - [x] Collect assistant text deltas as output text

- [x] 6.0 First skill + automation
  - [x] Create `skills/daily-review/SKILL.md`
  - [x] Create `automations/daily-review.md`
  - [x] Seed `workspaces/daily-review/notes.md`

- [x] 7.0 Cron install scripts
  - [x] Add `scripts/install-cron.ts`
  - [x] Add `scripts/uninstall-cron.ts`
  - [x] Add `scripts/list-cron.ts`
  - [x] Use marker blocks in user crontab
  - [x] Read 5-field cron schedule from automation frontmatter

- [~] 8.0 Live smoke test - Skipped: would invoke Pi/model and spend tokens without explicit confirmation
  - [x] Run `pnpm setup:db`
  - [~] Run `pnpm runner daily-review` - Skipped: model-spending smoke test deferred
  - [~] Confirm `runs` row exists - Skipped with model-spending smoke test
  - [~] Confirm `output_text` / workspace output exists - Skipped with model-spending smoke test
  - [~] Optionally run `pnpm install:cron daily-review` on the target server - Skipped: do not mutate local crontab without explicit approval

## Deferred

- Next.js dashboard
- systemd deployment
- auth
- automation editor UI
- custom Pi SDK integration
- custom tool allowlists
- MCP
