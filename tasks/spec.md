# jumpyGoatHq — target spec

This is the **pre-release target spec**. The implementation may temporarily lag while the agent refactor is in progress. Breaking changes are acceptable before release.

agenthq is a **minimal open-source, file-native control plane for Pi-powered agents**.

The core idea: define agents as markdown, run them through schedules or assigned tasks, store auditable run history, and expose only small gated extension points for connectors, tools, and operator surfaces. Pi owns the agent runtime. jumpyGoatHq owns the product primitives around it.

---

## Current stance

- Smallest useful Hermes/OpenClaw-like agent operations layer, not a feature clone.
- Single-operator/local-first before release.
- Pi is the harness; no custom LLM/tool loop.
- Files are the authoring source of truth.
- Shared SQLite is for run history/observability.
- Extension contracts should be simple enough for open-source contributors to add connectors/adapters without changing core internals.

---

## Primitives

| Primitive | Meaning | Backed by |
|---|---|---|
| **Agent** | User-facing runtime entity: Pi instructions, context, defaults, and capabilities | `agents/<name>/AGENT.md` + optional `agents/<name>/context/*.md` |
| **Automation** | Scheduled/manual invocation of one agent with one prompt | `automations/<name>.md` |
| **Board** | File-backed grouping/kanban for assignable work | `boards/<board>/BOARD.md` |
| **Task** | File-backed unit of work assigned to an agent | `boards/<board>/tasks/<task-id>.md` |
| **Schedule** | When an automation should run | `manual` or 5-field cron in automation frontmatter |
| **Dispatcher** | Local heartbeat that claims ready tasks and runs assigned agents | script/cron/systemd wrapper |
| **Run** | One auditable execution | shared `runs` row in SQLite |
| **Workspace** | Per-run/automation working directory | `workspaces/<name>/` |
| **Trace** | Raw Pi JSON events plus derived readable timeline | `runs.trace_text` |
| **Connector/tool** | Runner/gateway-owned extension capability | connector package + policy gates + env secrets |
| **Gateway** | Optional operator chat surface | browser now, Slack later, domain-only tools |

Skills are legacy MVP terminology. The product should converge on agents before release.

---

## Target mutable layout

Local default:

```txt
workspace/
  agents/<agent>/AGENT.md
  agents/<agent>/context/*.md
  automations/<automation>.md
  boards/<board>/BOARD.md
  boards/<board>/tasks/<task-id>.md
  data/jumpygoat-hq.sqlite
  workspaces/<automation-or-task>/
  traces/
```

Deployment override:

```bash
JUMPYGOATHQ_HOME=/var/lib/jumpygoat-hq
```

Then the same directories live directly under `$JUMPYGOATHQ_HOME`.

---

## Agent format

Target shape:

```markdown
---
name: daily-review
description: Reviews notes/issues and produces a concise daily brief
model: anthropic/claude-sonnet-4-5
allowedIntents:
  - notify.email
  - web.search
notify:
  email:
    enabled: true
    connector: resend
web:
  search:
    enabled: true
    connector: firecrawl
---

You are the daily review agent. Be concise. Identify blockers, due items, and recommended next actions.
```

Optional context files under `agents/<agent>/context/*.md` are loaded deterministically, likely alphabetically, and appended/included in the Pi instruction context.

Agent frontmatter owns defaults and capabilities. Secrets never live in agent files.

---

## Automation format

Target shape:

```markdown
---
agent: daily-review
schedule: "0 9 * * *"
model: anthropic/claude-sonnet-4-5
---

Review the workspace notes and open issues. Tell me what needs attention today.
```

Required:

- `agent`
- body prompt

Optional:

- `schedule` (`manual` or 5-field cron)
- `model` override
- narrow non-secret per-run connector overrides if needed

---

## Task/board format

Target board shape:

```markdown
---
name: launch-site
description: Website launch work
defaultAgent: web-operator
---

Board notes and constraints.
```

Target task shape:

```markdown
---
id: 2026-05-14-write-homepage-copy
title: Write homepage copy
board: launch-site
status: ready
assignee: marketing-agent
priority: medium
created_at: "2026-05-14T00:00:00.000Z"
updated_at: "2026-05-14T00:00:00.000Z"
attempts: 0
---

Write concise first-pass homepage copy for the product.
```

Initial statuses:

```txt
not-yet, ready, working-on-it, done
```

The first dispatcher can assume one local heartbeat and simple atomic file updates; no distributed queue in v1.

---

## Runtime flow: automation

`jumpygoat-hq-runner <automation>`:

1. Loads env and resolves `jumpyGoatHqHome()`.
2. Parses `automations/<name>.md`.
3. Resolves `agents/<agent>/AGENT.md` and optional context files.
4. Opens/initializes shared SQLite at `jumpyGoatHqHome()/data/jumpygoat-hq.sqlite` unless overridden.
5. Inserts a `runs` row with `status = running`.
6. Resolves connector/tool gates from agent capabilities plus automation/run config.
7. Spawns Pi with agent instructions/context and allowed extension tools.
8. Runs with a scoped cwd under `workspaces/`.
9. Captures raw Pi JSONL trace, assistant output, stderr/errors, and connector summaries.
10. Updates the run row with status, timing, trace, output, errors, and metadata.

---

## Runtime flow: task dispatcher

`dispatch:tasks` target behavior:

1. Scans `boards/*/tasks/*.md` for `status: ready` and `assignee`.
2. Validates the assignee agent exists.
3. Atomically claims one or a small batch by moving to `working-on-it` and incrementing attempts.
4. Builds a prompt from task body, task metadata, board context, and completion instructions.
5. Runs the assigned agent through the same Pi/run path.
6. Writes normal shared run rows associated with board/task metadata.
7. Transitions task to `done` on success or `not-yet` with dispatch notes on failure.

---

## Connector/tool contract

Connectors are extension-owned adapters for external services. They are exposed only when policy gates allow them.

Required gates:

1. agent declares the intent/capability;
2. automation/task/run context enables or requests it where appropriate;
3. required non-secret config exists;
4. required secrets exist in env/deployment secret store.

Examples:

```yaml
allowedIntents:
  - notify.email
  - web.search
```

Secrets stay in env:

```bash
RESEND_API_KEY=re_...
FIRECRAWL_API_KEY=fc_...
```

Connector results should be summarized into run metadata for auditability.

---

## Web/operator UI

The web UI remains minimal raw server-rendered HTML until complexity justifies otherwise.

Target pages:

- `/` dashboard
- `/agents`
- `/automations`
- `/boards`
- `/tasks` or `/kanban`
- `/schedule` or `/calendar`
- `/runs`
- `/runs/:id`
- optional `/pi` local browser gateway after safe domain tools exist

Mutations should call shared domain services, not duplicate validation in route handlers.

---

## Gateway direction

The gateway is an optional adapter layer, not the core product.

- Browser first.
- Slack Socket Mode later.
- Deny-by-default allowlists for Slack.
- Domain-only tools for chat-driven Pi sessions.
- No repo-wide shell/write access from Slack/browser sessions.
- Chat edits user-owned jumpyGoatHq workspace content through validated services only.

---

## Auth and environment

Preferred personal setup:

1. Run `pi /login` as the Unix user that runs jumpyGoatHq.
2. Verify `pi --mode json --no-session "hello"` works.
3. Run jumpyGoatHq under that same user for cron/systemd/web.

`.env.local` is optional and gitignored. Use it for provider env vars, connector secrets, and local overrides such as `JUMPYGOATHQ_HOME`.

---

## Non-goals before release

- workflow builder/DAG UI
- custom LLM/tool loop
- hosted SaaS
- multi-user/RBAC/team auth
- broad personal assistant feature set
- plugin marketplace
- generic public JSON API
- durable distributed task queue
- per-agent databases/memory system
- frontend framework migration without clear need

---

## Phase plan

| Phase | Ships |
|---|---|
| **now** | Agent entity refactor; docs/UI/runtime converge on `agent` as the product primitive |
| **next** | Shared domain services and path policy for safe mutations |
| **then** | File-backed boards/tasks and heartbeat dispatcher |
| **then** | Read-only schedule/calendar observability |
| **later** | Browser gateway, then Slack adapter with strict capability policy |
| **hardening** | systemd/timer deployment templates after primitives stabilize |
