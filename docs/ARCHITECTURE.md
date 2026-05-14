# agenthq architecture

agenthq is a personal runner for scheduled/manual Pi agents.

Strategic frame: agenthq should stay the smallest useful open-source Hermes/OpenClaw-like agent operations layer. Keep strong primitives, limited features, and clear extension seams; do not broaden into a workflow builder or feature clone.

```txt
automation.md -> agent AGENT.md (+ context/*.md) -> runner -> gated Pi connector extension -> pi --mode json -> SQLite run row -> raw HTML viewer
```

## Concepts

### Agent

A reusable Pi instruction bundle:

```text
workspace/agents/<name>/AGENT.md
workspace/agents/<name>/context/*.md
$AGENTHQ_HOME/agents/<name>/AGENT.md
```

`AGENT.md` frontmatter defines display metadata and defaults/capabilities such as `name`, `description`, optional `model`, `allowedIntents`, and connector defaults. Optional `context/*.md` files are loaded alphabetically and appended to the generated Pi instruction file for each run.

### Automation

A scheduled or manual invocation of one agent with one prompt:

```text
workspace/automations/<name>.md
$AGENTHQ_HOME/automations/<name>.md
```

Example:

```yaml
---
agent: your-agent
schedule: manual
model: gpt-5.5 # optional run override
---

Prompt for this run.
```

Automations are edited as files. The filename is the automation id. Active automation files are local/personal by default and gitignored in the public template.

### Connectors

Connectors are gated twice:

1. the agent frontmatter `allowedIntents` includes the provider-neutral intent; and
2. the agent or automation connector config enables that intent/provider.

Supported intents/tools: `web.search` → `web_search`, `web.scrape` → `web_scrape`, `web.crawl` → `web_crawl`, and `notify.email` → `notify_email`.

The runner passes a static Pi extension for enabled/allowed tools only. Pi can call tools during the run. Legacy post-run fenced `agenthq-action` email blocks remain temporarily for compatibility, but in-run Pi tools are the default connector architecture.

### Workspace

Per-automation Pi working directory:

```text
workspace/workspaces/<automation>/
$AGENTHQ_HOME/workspaces/<automation>/
```

The runner starts Pi with this directory as `cwd`. Runtime data only; gitignored.

### Run DB

One execution of one automation is stored in the shared SQLite DB:

```text
workspace/data/agenthq.sqlite
$AGENTHQ_HOME/data/agenthq.sqlite
```

The `runs` table stores automation, agent, optional legacy skill backfill, status/timing, output text, trace text, error text, and connector action JSON.

## Runtime flow

1. Cron or user runs `pnpm runner <automation>`.
2. Runner parses `agenthqHome()/automations/<automation>.md`.
3. Runner resolves `agenthqHome()/agents/<agent>/AGENT.md` plus alphabetical `context/*.md`.
4. Runner resolves effective model and connector plan from agent defaults plus automation overrides.
5. Runner writes a generated instruction file under the per-automation workspace and starts Pi:

   ```bash
   pi --mode json --no-session --skill <generated-agent-file> [--extension <connector-extension>] [--model <model>] <prompt>
   ```

6. Pi runs in `agenthqHome()/workspaces/<automation>/`.
7. Runner captures Pi JSON events into readable output/trace fields and updates the run row.

## Web viewer

Reads automations, agents, crontab, and SQLite. Default bind is `127.0.0.1:3000`.

Routes:

- `/`
- `/automations`, `/automations/new`, `/automations/:name`, `/automations/:name/edit`
- `/schedule` — read-only 7-day agenda/calendar of scheduled agent runs, cron install status, and orphan/malformed AgentHQ cron block warnings
- `/agents`, `/agents/new`, `/agents/:name`, `/agents/:name/edit`
- `/runs`, `/runs/:id`

Mutations are intentionally file-native POST actions: automation create/update/delete, cautious raw agent create/update/delete, and “Run now,” which shells out to `pnpm runner <automation>`. The schedule page does not mutate cron; automation markdown is the schedule source of truth and crontab blocks are status/evidence only.

## Validation

Coding agents can validate work from the repo root:

```bash
pnpm validate:web
pnpm validate:backend
pnpm validate
```

The backend smoke creates a temporary gitignored smoke agent/automation if needed, writes and verifies one SQLite `runs` row, then prints output/error/trace tails in-session for inspection. It does not run all automations or mutate cron.

## Environment and auth

Preferred personal setup: authenticate Pi once as the same Unix user that runs agenthq.

`.env.local` is optional and gitignored. Use it for provider env vars or overrides such as `AGENTHQ_HOME` or `AGENTHQ_DB_PATH`; `.env.example` is the commitable template. When unset, `agenthqHome()` is `repoRoot()/workspace`. When set, mutable state lives directly under `AGENTHQ_HOME`. Relative `AGENTHQ_DB_PATH` values resolve under `agenthqHome()`.

## Safety constraints

- Pi remains the agent harness; no custom LLM/tool loop.
- Browser editing is intentionally limited to file-native automation CRUD and cautious raw `AGENT.md` editing.
- Runtime/personal state is gitignored by default.
- Web auth is deferred; bind locally or put behind trusted proxy/auth.
