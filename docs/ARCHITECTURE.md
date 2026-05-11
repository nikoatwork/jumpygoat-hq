# agenthq architecture

agenthq is a personal runner for scheduled Pi skills.

```txt
automation.md -> runner -> gated Pi connector extension -> pi --mode json -> SQLite run row -> raw HTML viewer
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

Optional connector config may enable runner-owned external tools. Connector exposure requires both gates:

1. automation frontmatter enables the intent/provider; and
2. skill frontmatter `allowedIntents` includes the provider-neutral intent.

Examples:

```yaml
web:
  search:
    enabled: true
    connector: firecrawl
notify:
  email:
    enabled: true
    connector: resend
```

The runner passes a static Pi extension for enabled/allowed tools only. Pi can then call `web_search`, `web_scrape`, `web_crawl`, and `notify_email` during the run and observe successes/failures in context. Legacy post-run fenced `agenthq-action` email blocks remain temporarily for compatibility, but in-run Pi tools are the default connector architecture.

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

`output_text` is assistant text deltas. `trace_text` is raw Pi JSON event lines. The web viewer derives a compact human-readable timeline from this JSONL at render time while keeping the raw trace as the canonical artifact. `error_text` is stderr/errors. `connector_actions_json` records compact connector tool/action summaries for requests, skips, successes, and failures.

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
- `/runs/:id` with run metadata, derived trace timeline, output/error text, connector metadata, and raw trace JSONL in `<details>`

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
5. Runner resolves connector gates and spawns Pi:

   ```bash
   pi --mode json --no-session --skill <skill-file> [--extension <connector-extension>] [--model <model>] <prompt>
   ```

6. Pi runs in `workspaces/<automation>/`.
7. Runner captures Pi events and assistant output.
8. Runner extracts compact connector action summaries from Pi tool trace events and any legacy post-run actions.
9. Runner updates the SQLite row with status, duration, output, trace, errors, and `connector_actions_json`.
10. Web viewer displays the result.

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
