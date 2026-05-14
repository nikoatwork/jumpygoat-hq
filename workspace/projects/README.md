# AgentHQ projects and tasks

Projects and assigned tasks are file-backed runtime state under `agenthqHome()/projects/` (`workspace/projects/` locally by default or `$AGENTHQ_HOME/projects` when set). Active project directories are gitignored; this README is the committed contract.

## Layout

```txt
projects/<project>/PROJECT.md
projects/<project>/tasks/<task-id>.md
```

Names and ids use lowercase letters, numbers, and hyphens only.

## PROJECT.md

```md
---
name: Website refresh
description: Refresh launch pages and docs.
default_agent: web-agent # optional
---

Project context, constraints, links, and definition of done.
```

## Task markdown

```md
---
id: 20260514103000-update-homepage-copy
title: Update homepage copy
project: website-refresh
status: ready
assignee: web-agent
priority: normal
created_at: "2026-05-14T10:30:00.000Z"
updated_at: "2026-05-14T10:30:00.000Z"
claimed_at:
run_id:
attempts: 0
---

Task instructions for the assigned agent.
```

Required fields: `id`, `title`, `project`, `status`, `assignee`, `priority`, `created_at`, `updated_at`, and `attempts`. `claimed_at` and `run_id` are set by the dispatcher when applicable. Tasks may stay unassigned while in `backlog` or `blocked`; `ready` tasks need an `assignee`.

## Statuses

- `backlog` — captured but not ready for an agent.
- `ready` — dispatchable when `assignee` references an existing agent.
- `doing` — claimed by the heartbeat dispatcher.
- `review` — Pi run completed; operator should review output/changes.
- `done` — accepted by the operator.
- `blocked` — waiting on input or dependency.
- `failed` — dispatcher/Pi run failed; inspect `run_id` and dispatch notes.

Allowed v1 transitions:

```txt
backlog -> ready, blocked
ready -> backlog, doing, blocked
doing -> review, done, blocked, failed
review -> ready, done, blocked
done -> review, ready
blocked -> backlog, ready
failed -> ready, blocked
```

The web kanban uses POST status routes and vanilla-JS drag-and-drop as progressive enhancement. Markdown files remain the source of truth.

## Dispatcher

Run one heartbeat manually:

```bash
pnpm dispatch:tasks
```

By default one ready assigned task is claimed per heartbeat. Use `--limit=N` or `AGENTHQ_TASK_DISPATCH_LIMIT=N` for a small local batch. The v1 dispatcher assumes a single local cron/systemd timer, not a distributed worker pool.
