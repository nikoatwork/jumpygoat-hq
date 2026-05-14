# jumpyGoatHq boards and tasks

Boards and assigned tasks are file-backed runtime state under `jumpyGoatHqHome()/boards/` (`workspace/boards/` locally by default or `$JUMPYGOATHQ_HOME/boards` when set). Active board directories are gitignored; this README is the committed contract.

## Layout

```txt
boards/<board>/BOARD.md
boards/<board>/tasks/<task-id>.md
```

Names and ids use lowercase letters, numbers, and hyphens only.

## BOARD.md

```md
---
name: Website refresh
description: Refresh launch pages and docs.
default_agent: web-agent # optional
---

Board context, constraints, links, and definition of done.
```

## Task markdown

```md
---
id: 20260514103000-update-homepage-copy
title: Update homepage copy
board: website-refresh
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

Required fields: `id`, `title`, `board`, `status`, `assignee`, `priority`, `created_at`, `updated_at`, and `attempts`. `claimed_at` and `run_id` are set by the dispatcher when applicable. Tasks may stay unassigned while in `not-yet` or `done`; `ready` and `working-on-it` tasks need an `assignee`.

## Statuses

- `not-yet` — captured, parked, or not yet ready for an agent.
- `ready` — dispatchable when `assignee` references an existing agent.
- `working-on-it` — claimed/in progress.
- `done` — completed.

The dispatcher scans for `ready` tasks with an assignee, claims one by moving it to `working-on-it`, and moves success to `done`. Failed runs move the task back to `not-yet` with a dispatch note and latest-run evidence in the web UI.

The web kanban uses POST status routes and vanilla-JS drag-and-drop as progressive enhancement. Markdown files remain the source of truth.

## Dispatcher

Run one heartbeat manually:

```bash
pnpm dispatch:tasks
```

By default one ready assigned task is claimed per heartbeat. Use `--limit=N` or `JUMPYGOATHQ_TASK_DISPATCH_LIMIT=N` for a small local batch. The v1 dispatcher assumes a single local cron/systemd timer, not a distributed worker pool.
