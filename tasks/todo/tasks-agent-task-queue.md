# Agent Task Queue — File-Backed Kanban v1

## Goal

Add a small task assignment/kanban layer so operators can create markdown tasks, assign them to agents, and let a heartbeat dispatcher pick up ready work. Keep v1 file-backed and simple: projects group tasks, tasks have status/assignee/priority metadata, assigned agents execute tasks through Pi, the shared run DB remains the run history, and the web UI includes a raw HTML kanban board with vanilla-JS drag-and-drop as progressive enhancement.

## Notes

- This depends conceptually on the Agent Entity work (`tasks/todo/tasks-agent-entity.md`). Implement after or alongside that refactor.
- Keep v1 small: no workflow engine, no multi-step graph, no per-agent SQLite, no complex scheduling, no frontend framework.
- Source of truth for tasks/projects should be markdown under `agenthqHome()`.
- Shared SQLite remains for runs only unless a later indexing need emerges.
- Heartbeat should claim tasks safely enough for one local dispatcher; avoid over-engineering distributed locks in v1.
- Proposed local/deploy layout:
  - `agenthqHome()/projects/<project>/PROJECT.md`
  - `agenthqHome()/projects/<project>/tasks/<task-id>.md`
- Proposed minimal statuses: `backlog`, `ready`, `doing`, `review`, `done`, `blocked`, `failed`.
- Proposed heartbeat command: `pnpm dispatch:tasks` or similar, intended for cron/systemd timer.
- Kanban drag-and-drop should be progressive enhancement over normal POST/status buttons. Markdown files remain the source of truth.

## Relevant Files

- `packages/shared/paths.js` - Add project/task path helpers.
- `packages/shared/paths.d.ts` - Type declarations for project/task helpers.
- `packages/shared/tasks.js` - Shared project/task parser, serializer, validators, and atomic status writes.
- `packages/shared/tasks.d.ts` - Type declarations for shared project/task helpers.
- `packages/runner/src/automation.ts` - Reference point for parsing markdown/frontmatter patterns.
- `packages/runner/src/index.ts` - Reference point for invoking agent runs and writing run rows.
- `packages/runner/src/db.ts` - Shared run DB; may need optional task/project columns or run metadata.
- `packages/runner/src/pi.ts` - Pi invocation helper to reuse for task execution.
- `packages/runner/src/task.ts` - New task/project parser and serializer.
- `packages/runner/src/dispatcher.ts` - New heartbeat dispatcher logic.
- `scripts/dispatch-tasks.ts` - CLI wrapper for heartbeat task dispatch.
- `package.json` - Add `dispatch:tasks` script.
- `packages/web/src/readers.ts` - Add project/task readers for UI.
- `packages/web/src/actions.ts` - Add task/project CRUD and status transitions.
- `packages/web/src/routes.ts` - Add Projects/Tasks/Kanban pages and action/status routes.
- `packages/web/src/html.ts` - Navigation updates if needed.
- `packages/web/public/kanban.js` - Small vanilla-JS drag-and-drop enhancement for task status changes.
- `packages/web/public/styles.css` - Kanban columns/cards/drop-target styling.
- `workspace/projects/README.md` - Canonical docs for project/task markdown.
- `.gitignore` - Ignore active `workspace/projects/*` while allowing README docs.
- `README.md` - Update mental model and heartbeat setup.
- `docs/ARCHITECTURE.md` - Add Project/Task/Dispatcher concepts and runtime flow.
- `docs/DEPLOY.md` - Add `$AGENTHQ_HOME/projects` and heartbeat cron/systemd timer instructions.
- `packages/web/DOCS.md` - Document task/kanban routes and safety constraints.
- `AGENTS.md` - Update hard constraints/docs references.
- `tasks/CHANGELOG.md` - Update when complete.

## Tasks

- [x] 1.0 Define the v1 task/project contract
  - [x] 1.1 Decide canonical project layout: `projects/<project>/PROJECT.md` and `projects/<project>/tasks/*.md`.
  - [x] 1.2 Define `PROJECT.md` frontmatter/body fields: `name`, `description`, optional default agent/context.
  - [x] 1.3 Define task frontmatter fields: `id`, `title`, `project`, `status`, `assignee`, `priority`, `created_at`, `updated_at`, optional `claimed_at`, `run_id`, `attempts`.
  - [x] 1.4 Define allowed status transitions for v1.
  - [x] 1.5 Decide task ID format, e.g. date slug or ULID slug.
  - [x] 1.6 Decide whether dispatcher handles one task per heartbeat or a small configurable batch.

- [x] 2.0 Add paths, docs scaffolding, and ignore rules
  - [x] 2.1 Add shared helpers for `projectsDir()`, `projectDir(name)`, `projectPath(name)`, `tasksDir(project)`, and `taskPath(project, id)`.
  - [x] 2.2 Add `workspace/projects/README.md` with project/task examples and status definitions.
  - [x] 2.3 Update `.gitignore` to ignore active project/task markdown while committing `workspace/projects/README.md`.
  - [x] 2.4 Update `AGENTS.md` references once project/task docs exist.

- [x] 3.0 Implement task/project parsing and safe writes
  - [x] 3.1 Add parser/validator for project markdown.
  - [x] 3.2 Add parser/validator for task markdown/frontmatter.
  - [x] 3.3 Add canonical task serializer that preserves body content where practical.
  - [x] 3.4 Add atomic write/update helper for task status changes.
  - [x] 3.5 Add safe name/id validation to prevent path traversal.

- [x] 4.0 Implement heartbeat dispatcher
  - [x] 4.1 Add `dispatch:tasks` CLI/script.
  - [x] 4.2 Scan all project task files for `status: ready` and non-empty `assignee`.
  - [x] 4.3 Validate assignee agent exists before claiming.
  - [x] 4.4 Claim a task by atomically changing `status` from `ready` to `doing`, setting `claimed_at`, and incrementing `attempts`.
  - [x] 4.5 Execute the task with the assigned agent through the existing Pi runner path.
  - [x] 4.6 Include task body, project context, task metadata, and clear completion instructions in the prompt.
  - [x] 4.7 Write a normal run row in the shared DB and associate the task/project in metadata or columns.
  - [x] 4.8 On success, transition task to `review` or `done` based on v1 decision.
  - [x] 4.9 On failure, transition task to `failed` and append error/run info.
  - [x] 4.10 Print concise dispatch output for cron logs.

- [x] 5.0 Add minimal web task/project UI
  - [x] 5.1 Add Projects/Tasks navigation.
  - [x] 5.2 Add project list/detail pages.
  - [x] 5.3 Add task kanban page grouped by status columns.
  - [x] 5.4 Add create/edit task form with title, project, status, assignee, priority, and body.
  - [x] 5.5 Add simple non-JS status transition actions: mark ready, block, review, done.
  - [x] 5.6 Add vanilla-JS drag-and-drop from card to status column as progressive enhancement over status POST routes.
  - [x] 5.7 Ensure drag/drop posts to the server, updates markdown frontmatter atomically, and reloads or updates UI safely.
  - [x] 5.8 Show latest associated run link/status when available.
  - [x] 5.9 Keep UI raw HTML and file-native, consistent with current web constraints.

- [x] 6.0 Integrate with runs and DB metadata
  - [x] 6.1 Decide whether to add nullable `project` and `task_id` columns to `runs`.
  - [x] 6.2 If adding columns, update DB migrations and run insert/finish APIs.
  - [x] 6.3 Update run detail pages to show project/task metadata.
  - [x] 6.4 Update task pages to link back to run details.

- [x] 7.0 Add heartbeat deployment docs
  - [x] 7.1 Document manual dispatch command.
  - [x] 7.2 Document cron example for heartbeat, e.g. every minute or every five minutes.
  - [x] 7.3 Document single-dispatcher assumption and expected task status lifecycle.
  - [x] 7.4 Update VPS deployment docs to create `$AGENTHQ_HOME/projects`.

- [x] 8.0 Validate
  - [x] 8.1 Run `pnpm build`.
  - [x] 8.2 Run `pnpm validate:web` and inspect Playwright output.
  - [x] 8.3 Run `pnpm validate:backend` if local Pi auth/provider availability is expected.
  - [x] 8.4 Manually verify creating a project/task via web writes under `workspace/projects/`.
  - [x] 8.5 Manually verify kanban status buttons and drag-and-drop update task markdown status.
  - [x] 8.6 Manually verify `dispatch:tasks` claims exactly one ready task and updates status/run metadata.
  - [x] 8.7 Manually verify `AGENTHQ_HOME=/tmp/agenthq-task-test pnpm ...` uses external `projects/`, agents, and run DB paths.

## Decisions

- Use markdown files as the task/project source of truth for v1.
- Keep one shared run DB; do not add per-agent or per-project SQLite.
- Keep heartbeat/dispatcher simple and local; no distributed queue or worker pool yet.
- Implement kanban drag-and-drop with vanilla JS only; no React/frontend framework.
- Model task assignment to agents, not direct assignment to skills.

## Changelog

- 2026-05-14: Implemented file-backed projects/tasks, dispatcher, web kanban/status routes, run metadata, docs, and validation.
- Updated `tasks/CHANGELOG.md` when complete.
