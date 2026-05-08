# agenthq architecture

agenthq is a personal runner for scheduled Pi skills.

```txt
automation.md -> runner -> pi --mode json -> optional connector action -> SQLite run row -> raw HTML viewer
```

## Concepts

### Skill

A reusable Pi skill.

```txt
skills/<name>/SKILL.md
```

Skills describe how Pi should perform a class of work. They follow the Agent Skills/Pi skill format: frontmatter plus instructions.

### Automation

A scheduled invocation of one skill with one prompt.

```txt
automations/<name>.md
```

Format:

```md
---
skill: daily-review
schedule: "0 9 * * *"
model: optional-pi-model-selector
---

Prompt body sent to Pi.
```

Automations are edited as files. The filename is the automation id.

Optional connector config may enable runner-owned external actions, such as Resend email notifications:

```yaml
notify:
  email:
    enabled: true
    connector: resend
```

Skills still decide whether to request an action by emitting a fenced `agenthq-action` JSON block, and the runner executes only allowed/enabled intents.

### Workspace

Per-automation working directory.

```txt
workspaces/<automation>/
```

The runner starts Pi with this directory as `cwd`. Runtime data only; gitignored.

### Run

One execution of one automation.

Stored in SQLite:

```txt
data/agenthq.sqlite
```

Table: `runs`

```sql
id text primary key
automation text
skill text
model text
schedule text
status text
started_at text
finished_at text
duration_ms integer
exit_code integer
signal text
output_text text
trace_text text
error_text text
connector_actions_json text
```

`output_text` is assistant text deltas. `trace_text` is raw Pi JSON event lines. `error_text` is stderr/errors. `connector_actions_json` records notification/write-back actions requested, skipped, sent, or failed.

### Schedule

A 5-field cron expression in automation frontmatter.

Installed into the current user's crontab with marked blocks:

```cron
# agenthq:start daily-review
0 9 * * * cd /repo && /bin/bash -lc '... pnpm runner daily-review ...'
# agenthq:end daily-review
```

Commands:

```bash
pnpm install:cron <automation>
pnpm list:cron
pnpm uninstall:cron <automation>
```

### Web viewer

A minimal raw HTML server.

```txt
packages/web
```

Reads automations, skills, crontab, and SQLite. Default bind is `127.0.0.1:3000`.

Routes:

- `/` dashboard
- `/automations`
- `/automations/new`
- `/automations/:name`
- `/automations/:name/edit`
- `/skills`
- `/skills/new`
- `/skills/:name`
- `/skills/:name/edit`
- `/runs`
- `/runs/:id`

Mutations are intentionally file-native POST actions: automation create/update/delete, cautious raw skill create/update/delete, and “Run now,” which shells out to `pnpm runner <automation>`.

### Local validation loop

Coding agents can validate work from the repo root:

```bash
pnpm validate:web       # Playwright smoke checks for the raw HTML viewer
pnpm validate:backend   # one Pi-backed automation smoke run, default daily-review
pnpm validate           # web smoke, then backend smoke
```

The backend smoke writes and verifies one SQLite `runs` row, then prints output/error/trace tails in-session for agent inspection. It does not run all automations or mutate cron.

## Runtime flow

1. Cron or user runs `pnpm runner <automation>`.
2. Runner parses `automations/<automation>.md`.
3. Runner resolves `skills/<skill>/SKILL.md`.
4. Runner inserts `runs.status = running`.
5. Runner spawns Pi:

   ```bash
   pi --mode json --no-session --skill <skill-file> [--model <model>] <prompt>
   ```

6. Pi runs in `workspaces/<automation>/`.
7. Runner captures Pi events and assistant output.
8. Runner updates the SQLite row with status, duration, output, trace, and errors.
9. Web viewer displays the result.

## Auth/secrets

Preferred personal setup: authenticate Pi once as the same Unix user that runs agenthq.

```bash
pi /login
```

`.env.local` is optional and gitignored. Use it for provider env vars or overrides such as `AGENTHQ_DB_PATH`; `.env.example` is the commitable template.

## Current boundaries

- No workflow graph.
- No custom LLM/tool loop.
- No multi-user auth.
- Browser editing is intentionally limited to file-native automation CRUD and cautious raw `SKILL.md` editing.
- No custom sandbox yet.
- Web UI is local/private unless placed behind trusted auth/proxy.
