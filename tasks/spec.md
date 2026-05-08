# agenthq — spec

agenthq is a **personal cron/systemd runner for Pi skills**.

The core idea: write one markdown automation file, point it at a Pi skill, put it on a schedule, and let Pi do the work. agenthq owns the thin wrapper around scheduling, run storage, and observability. Pi owns the agent runtime.

---

## Current stance

- Personal repo/tool first: operator = user.
- Pi is the harness.
- Automations and skills are files.
- Past runs live in a local SQLite DB that is gitignored.
- Prefer Pi's stored login (`pi /login`) for auth; `.env` is optional for overrides/provider env vars.

---

## Primitives

| Primitive | Meaning | Backed by |
|---|---|---|
| **Skill** | A Pi skill/context package | `skills/<name>/SKILL.md` |
| **Automation** | A scheduled invocation of one skill with one prompt | `automations/<name>.md` |
| **Schedule** | When to run the automation | 5-field cron in frontmatter; installed into user crontab |
| **Run** | One execution of one automation | `runs` row in SQLite |
| **Workspace** | Per-automation working directory | `workspaces/<name>/` |
| **Trace** | Dumb text trace of Pi JSON events | `runs.trace_text` |
| **Connector** | Runner-owned adapter for an external service | `packages/runner/src/connectors.ts` + env |
| **Connector action** | A skill-requested external action intent | fenced `agenthq-action` JSON in Pi output |

---

## Automation format

```markdown
---
skill: daily-review
schedule: "manual"
model: anthropic/claude-sonnet-4-5
notify:
  email:
    enabled: true
    connector: resend
    to: you@example.com
    from: "AgentHQ <agent@yourdomain.com>"
    subjectPrefix: "[agenthq] "
---

Review my project notes and produce a concise daily brief.
```

Required:

- `skill`
- body prompt

Optional:

- `schedule`
- `model`
- `notify.email.enabled` / `connector` / `to` / `from` / `subjectPrefix` for opt-in email notifications

---

## Runtime

`agenthq-runner <automation>`:

1. Loads `.env` with `dotenv`.
2. Parses `automations/<name>.md`.
3. Resolves `skills/<skill>/SKILL.md`.
4. Opens/initializes SQLite at `AGENTHQ_DB_PATH` or `data/agenthq.sqlite`.
5. Inserts a `runs` row with `status = running`.
6. Spawns Pi:

   ```bash
   pi --mode json --no-session --skill <skill-path> [--model <model>] <prompt>
   ```

7. Runs with `cwd = workspaces/<automation>/`.
8. Accumulates raw Pi JSON lines into `trace_text`.
9. Accumulates assistant text deltas into `output_text`.
10. If the Pi run succeeded, parses `output_text` for an optional connector action block.
11. Executes only the intersection of skill-allowed intents, automation-enabled connector config, and valid requested action.
12. Updates the `runs` row with status, duration, exit code, output, trace, errors, and connector action metadata.

---

## v0 connector and notification contract

Connectors are runner-owned adapters for external services. Skills do not call provider APIs directly and should not mention provider-specific secrets. A skill may request an external action only by emitting a machine-readable action block in its normal output.

For v0, the only implemented connector is Resend email for the `notify.email` intent. A skill must declare the intent in `SKILL.md` frontmatter:

```yaml
allowedIntents:
  - notify.email
```

An automation must also enable email notifications in frontmatter:

```yaml
notify:
  email:
    enabled: true
    connector: resend
    to: you@example.com
    from: "AgentHQ <agent@yourdomain.com>"
    subjectPrefix: "[agenthq] "
```

Secrets stay in env only:

```bash
RESEND_API_KEY=re_...
```

Optional non-secret defaults may also come from env and are used when automation frontmatter omits them:

```bash
AGENTHQ_NOTIFY_EMAIL_TO=you@example.com
AGENTHQ_NOTIFY_EMAIL_FROM="AgentHQ <agent@yourdomain.com>"
AGENTHQ_NOTIFY_SUBJECT_PREFIX="[agenthq] "
```

A skill requests notification by including one fenced JSON block:

````markdown
```agenthq-action
{
  "type": "notify.email",
  "subject": "Daily review needs attention",
  "body": "You have 3 overdue items and one blocked task."
}
```
````

Compatibility form with `notify: true` is accepted as `notify.email`, but new skills should use `type: "notify.email"`.

Behavior:

- No action block: store run output and send nothing.
- Malformed action block: record `skipped_malformed` metadata and send nothing.
- Action not listed in skill `allowedIntents`: record `skipped_not_allowed` and send nothing.
- Automation notification config missing or disabled: record `skipped_disabled` and send nothing.
- Missing `RESEND_API_KEY`, recipient, or sender: record a non-fatal `failed_missing_config` and keep the run status based on Pi.
- Resend delivery failure: record a non-fatal `failed_delivery` and keep the run status based on Pi.
- Failed Pi runs do not send normal success notifications; requested actions are recorded as `skipped_run_failed`.

---

## SQLite schema

SQLite is local runtime state and is gitignored.

Default path:

```txt
data/agenthq.sqlite
```

Override:

```bash
AGENTHQ_DB_PATH=/some/path.sqlite
```

Schema:

```sql
create table if not exists runs (
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
  error_text text not null default '',
  connector_actions_json text not null default '[]'
);
```

Setup command:

```bash
pnpm setup:db
```

---

## Auth and environment

Preferred personal setup:

1. SSH into the server as the Unix user that will run cron.
2. Run `pi /login`.
3. Verify `pi --mode json --no-session "hello"` works.
4. Run agenthq under that same user.

Pi's stored auth normally lives under `~/.pi/agent/auth.json`. Cron entries export `HOME` and `PATH` so the spawned Pi process can find the same auth and binary.

`.env` is optional and gitignored. Use it for provider-specific env vars or `AGENTHQ_DB_PATH` overrides. Current likely provider is Vercel AI Gateway, but agenthq should not hardcode that provider.

`pnpm run doctor` checks Node, pnpm, Pi, cron, SQLite, and likely Pi auth state.

---

## Non-goals now

- workflow builder
- custom LLM/tool loop
- public dashboard
- multi-user auth
- MCP platform
- normalized tracing schema

---

## Cron scheduling

Schedules are installed into the current user's crontab with safe marker blocks:

```bash
pnpm install:cron daily-review
pnpm list:cron
pnpm uninstall:cron daily-review
```

Generated entries look like:

```cron
# agenthq:start daily-review
0 9 * * * cd /path/to/agenthq && /bin/bash -lc 'pnpm runner daily-review >> data/cron-daily-review.log 2>&1'
# agenthq:end daily-review
```

Use server-local cron first. Coolify/API-triggered scheduling can be added later if deploy hooks become useful, but the recurring schedule should live with the runner.

## Minimal web viewer

`packages/web` is a tiny Node `http` server that renders raw HTML. It has no frontend framework and no client-side app. It reads:

- `automations/*.md`
- `skills/*/SKILL.md`
- marked agenthq crontab blocks
- SQLite `runs`

Default bind is `HOST=127.0.0.1`, `PORT=3000`. Use `HOST=0.0.0.0` only behind trusted proxy/auth/firewall.

Pages:

- `/` dashboard
- `/automations`
- `/skills`
- `/runs`
- `/runs/:id`

Only mutation for now: `POST /automations/:name/run` to run an automation immediately.

## Phase plan

| Phase | Ships |
|---|---|
| **v0** | TS runner, `.env`, SQLite runs table, one skill, one automation, cron install scripts |
| **v1** | minimal raw HTML viewer over automations, skills, crontab, and SQLite runs |
| **later** | stricter sandbox/tool policy, dashboard editing, auth, Coolify/deploy hooks |
