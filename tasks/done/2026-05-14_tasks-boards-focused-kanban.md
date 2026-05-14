# Boards and Focused Task Kanban

## Completion Summary

Completed on 2026-05-14. AgentHQ now uses boards as the file-backed task grouping primitive, writes board task markdown under `workspace/boards/<board>/`, uses `not-yet`/`ready`/`working-on-it`/`done` statuses, keeps `ready` as the dispatchable queue, and supports focused task board URLs via `?status=<status>`. Validation passed with `pnpm validate:web`, `pnpm validate:backend`, `pnpm check:design`, and `pnpm build`.

## Goal

Rename the project/task surface to broader "boards" language and simplify the default task board around four opinionated columns: `not yet`, `ready`, `working on it`, and `done`. Add a focused task-board view where one column is expanded via a query param while the other columns are collapsed, inspired by Fizzy's room-like column IA.

## Evaluation

- "Boards" is a better product primitive than "projects" for AgentHQ because it can cover projects, queues, decision lists, personal ops, and agent work streams without implying a fixed deliverable.
- The four-status default keeps an explicit dispatchable `ready` queue while reducing Kanban noise; `/tasks` should feel less like Jira/Trello and more like a focused operator surface.
- Decision: do a full pre-release rename from projects to boards rather than a UI-only alias.
- Data-structure complexity should stay low: the existing `projects/<project>/tasks/*.md` model already represents one kanban board with many task cards. The rename can become `boards/<board>/BOARD.md` plus `boards/<board>/tasks/*.md`; no new nested board model is needed unless we want multiple kanbans inside one board later.
- Decision: use four visible default columns: `not yet`, `ready`, `working on it`, and `done`. `ready` remains the dispatchable queue state; `working on it` replaces/renames the current claimed/in-progress state.
- Focused view should be URL-addressable and non-JS friendly via `status=`, e.g. `/tasks?status=working-on-it` or `/boards/<board>/tasks?status=done`; collapsed columns should still show names/counts and links to switch focus.

## Clarifying Questions

1. Answered: full domain/storage rename to boards while pre-release.
2. Answered: introduce `ready` as the fourth visible column and keep it dispatchable.
3. Answered: focused task-board view uses `status=`.

## Relevant Files

- `packages/shared/tasks.js` / `packages/shared/tasks.d.ts` - Canonical statuses, transitions, markdown parsing/writing.
- `packages/shared/paths.js` / `packages/shared/paths.d.ts` - Project/board filesystem paths.
- `packages/web/src/routes.ts` - `/boards`, `/tasks`, task forms, kanban rendering, status actions, and detail links.
- `packages/web/public/styles.css` - Kanban layout, expanded/collapsed focused-column styles.
- `packages/web/public/kanban.js` - Drag/drop status updates; will need to respect collapsed columns.
- `packages/web/src/actions.ts` - Form parsing/validation, task status rules, board CRUD.
- `packages/web/src/readers.ts` - Board and task listing/read logic.
- `packages/web/src/html.ts` - Sidebar/nav labels and active route handling.
- `packages/runner/src/dispatcher.ts` - Dispatchable status, claim status, post-run success/failure transitions.
- `packages/runner/src/task.ts` - Task status CLI/display helpers.
- `docs/ARCHITECTURE.md`, `workspace/boards/README.md`, `workspace/projects/README.md`, `tasks/spec.md`, `packages/web/DOCS.md` - Product/runtime docs to update.
- `tests/web/smoke.spec.ts` and related web tests - Coverage for routes, labels, focused view, and task creation.

## Tasks

- [x] 1.0 Decide the domain model and migration boundary
  - [x] 1.1 Answer whether boards are a full storage/API rename or UI alias first.
  - [x] 1.2 Decide whether existing `/projects` routes redirect to `/boards` or are removed. Redirect GET routes for operator ergonomics; new writes use `/boards`.
  - [x] 1.3 Decide whether `project` frontmatter becomes `board`, or whether task markdown keeps `project` for one migration cycle. New task markdown writes `board`; parser accepts legacy `project`.
  - [x] 1.4 Define local-state migration expectations for existing `workspace/projects/*` data. Pre-release source of truth is `workspace/boards/*`; legacy projects README points to boards.

- [x] 2.0 Define the four-status lifecycle
  - [x] 2.1 Use canonical status slugs and labels: `not-yet` (`not yet`), `ready` (`ready`), `working-on-it` (`working on it`), and `done` (`done`).
  - [x] 2.2 Keep `ready` as the dispatchable status for the task heartbeat.
  - [x] 2.3 Map claimed/in-progress work to `working-on-it`.
  - [x] 2.4 Decide whether failed run state is a visible non-default status, a task warning/badge, or appended task metadata. Failed runs move to `not-yet` with dispatch notes and latest-run evidence.
  - [x] 2.5 Update task transition rules and validation once failure semantics are final.

- [x] 3.0 Rename projects to boards in the web UI
  - [x] 3.1 Update sidebar, page headings, buttons, empty states, and helper text from Projects to Boards.
  - [x] 3.2 Add `/boards`, `/boards/new`, `/boards/:board`, and board task links.
  - [x] 3.3 Update create/edit forms to use board terminology.
  - [x] 3.4 Preserve or redirect old project URLs according to the migration decision.

- [x] 4.0 Update file/runtime contracts
  - [x] 4.1 Rename or alias shared path helpers from project to board.
  - [x] 4.2 Update readers/actions to load boards and tasks from the chosen source of truth.
  - [x] 4.3 Update runner dispatch metadata and run rows only where necessary; avoid DB churn unless the domain rename requires it.
  - [x] 4.4 Update markdown serializers/parsers for chosen `board`/`project` frontmatter strategy.

- [x] 5.0 Implement default four-column task board
  - [x] 5.1 Replace default task columns with `not yet`, `ready`, `working on it`, and `done`.
  - [x] 5.2 Update task creation defaults so new tasks start in `not yet` unless a column button prefills another status.
  - [x] 5.3 Update per-column `+ new task` links to use the new status slugs.
  - [x] 5.4 Update drag/drop and non-JS status actions for the new transition model.

- [x] 6.0 Implement focused column view
  - [x] 6.1 Add parser/validation for the `status=` focus query param.
  - [x] 6.2 Render focused mode with one expanded column and collapsed summary columns showing label, count, and switch-focus links.
  - [x] 6.3 Add clear/all-columns link from focused mode.
  - [x] 6.4 Ensure focused mode composes with board filtering and task creation links.
  - [x] 6.5 Keep drag/drop behavior safe for collapsed columns or disable drops onto collapsed summaries.

- [x] 7.0 Update documentation and tests
  - [x] 7.1 Update architecture, web docs, workspace contract docs, spec, and changelog references.
  - [x] 7.2 Add/update Playwright tests for `/boards`, board task creation, new statuses, and focused-column behavior.
  - [x] 7.3 Add/update backend tests or smoke coverage for dispatcher status semantics.
  - [x] 7.4 Run `pnpm validate:web`; run `pnpm validate:backend` if dispatcher/runtime status behavior changes.
  - [x] 7.5 Run final design/build validation after follow-up polish.

## Changelog

- Update `tasks/CHANGELOG.md` when implementation is complete.
