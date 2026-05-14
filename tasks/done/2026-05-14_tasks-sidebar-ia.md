# Sidebar Information Architecture

## Goal

Restructure the web viewer navigation around a scalable sidebar. Preserve the current dashboard as the overview, group Schedule under Automations, keep Agents as the user-facing noun, and move Settings to a visually separated sidebar footer.

## Completion Summary

Completed the sidebar IA and shared app shell, aligned route copy/docs with the current Boards terminology, introduced the shared invocation/run primitive work, fixed Overview active-state detection, expanded web smoke coverage for active sidebar items, and validated with design checks, Playwright web smoke, backend smoke, and a manual active-state pass across top-level and detail pages.

## Notes

- Keep the web UI server-rendered/raw HTML; no frontend framework or client-side routing.
- Keep existing routes for now; this is an information hierarchy and layout change, not a route migration.
- Product language is preferred, but retain core nouns: Overview, Tasks, Boards (formerly Projects), Automations, Schedule, Agents, Runs, Settings.
- Schedule is a view of automations, not a standalone domain object.
- Tasks and Automations are related one-agent prompt executions, but should remain separate UX concepts for now.
- Task execution should be driven by a heartbeat dispatcher cron, e.g. hourly `pnpm dispatch:tasks`, which claims ready assigned tasks and runs them with their assignee agent.

## Relevant Files

- `docs/ARCHITECTURE.md` - Domain model and current web route map.
- `packages/web/DOCS.md` - Web UI constraints, route list, design conventions, validation guidance.
- `packages/web/src/html.ts` - Shared layout/nav rendering and HTML helpers.
- `packages/web/public/styles.css` - Global theme and layout styles.
- `packages/web/src/routes.ts` - Route handlers and page titles/copy that may need language alignment.
- `packages/web/` Playwright validation coverage - Existing web smoke checks for affected pages.
- `packages/runner/src/invocation.ts` - Shared invocation primitive for automation/task runs.
- `packages/runner/src/execute.ts` - Shared invocation execution lifecycle.
- `packages/runner/src/dispatcher.ts` - Task heartbeat dispatcher using task invocations.
- `packages/runner/src/db.ts` - Run persistence with source metadata.
- `tests/web/smoke.spec.ts` - Sidebar/nav copy smoke expectations.

## Tasks

- [x] 1.0 Define the sidebar IA and labels
  - [x] 1.1 Confirm final nav structure: Overview; Work group with Tasks and Boards (renamed from Projects); Automations group with All Automations and Schedule; Agents; Activity/Runs; Settings footer.
  - [x] 1.2 Decide whether the nav item should display `Runs` or product-y `Activity` while keeping the page title as Runs.
  - [x] 1.3 Define active-state behavior for nested pages such as `/automations/:name`, `/boards/:board`, task detail, and `/runs/:id`.

- [x] 2.0 Update shared layout markup
  - [x] 2.1 Replace the top horizontal nav in `packages/web/src/html.ts` with an app shell containing a sidebar and main content area.
  - [x] 2.2 Render grouped navigation with Schedule nested under Automations.
  - [x] 2.3 Pin or visually separate Settings at the bottom of the sidebar.
  - [x] 2.4 Add accessible labels/landmarks for the sidebar navigation.
  - [x] 2.5 Preserve all existing route hrefs to avoid backend/route churn.

- [x] 3.0 Update responsive sidebar styling
  - [x] 3.1 Add app-shell/sidebar CSS in `packages/web/public/styles.css`.
  - [x] 3.2 Ensure desktop layout uses a persistent left sidebar and the content area remains readable at current max width.
  - [x] 3.3 Define mobile behavior, likely stacking the sidebar above content or converting it to a compact wrapped nav.
  - [x] 3.4 Add active, group, nested, and footer styles consistent with the existing operator noir theme.
  - [x] 3.5 Confirm tables, kanban, schedule, and trace pages still fit without horizontal layout regressions via existing Playwright coverage and design checks.

- [x] 4.0 Align page language with the new mental model
  - [x] 4.1 Update Overview/dashboard copy only if needed; keep it as the landing summary.
  - [x] 4.2 Update Automations page copy to describe automations as reusable prompts that can run manually or on a schedule.
  - [x] 4.3 Update Schedule page copy to describe it as a timeline view of scheduled automations.
  - [x] 4.4 Update Agents page copy to describe agents as reusable personalities with context, tools, and model defaults.
  - [x] 4.5 Update Tasks page copy to describe tasks as one-off prompts assigned to agents.

- [x] 5.0 Introduce a shared backend invocation primitive
  - [x] 5.1 Add an internal runner type such as `Invocation`/`RunSpec` that represents one Pi execution: source, agent, prompt, model override, connector overrides, schedule label, and workspace key.
  - [x] 5.2 Convert automation files into invocations for manual/scheduled runs.
  - [x] 5.3 Convert ready tasks into invocations without fabricating a fake automation object.
  - [x] 5.4 Keep task dispatch as a heartbeat flow: scan source-of-truth tasks for `status: ready` plus valid `assignee`, claim one or more, run with the assignee agent, then move to `review`/`failed`.
  - [x] 5.5 Extract duplicated run lifecycle logic from `packages/runner/src/index.ts` and `packages/runner/src/dispatcher.ts` into a shared execution function.
  - [x] 5.6 Rename internal Pi runner helpers from automation-specific language toward invocation/run language where practical.
  - [x] 5.7 Preserve user-facing file concepts: automations stay reusable/schedulable prompts; tasks stay one-off/board-scoped prompts.

- [x] 6.0 Clean up run persistence and traces for the new model
  - [x] 6.1 Decide whether to add explicit `source_type`/`source_id` run columns now, or keep existing `automation` plus `project`/`task_id` columns with clearer internal mapping.
  - [x] 6.2 Stop labeling task-dispatched runs as automations in trace metadata except where retaining legacy fields is useful for compatibility.
  - [x] 6.3 Ensure `/runs`, task latest-run lookup, automation run history, and trace timeline still render both automation and task runs clearly.
  - [x] 6.4 Update `docs/ARCHITECTURE.md` to show: automation/task source -> invocation -> runner -> Pi -> run row.

- [x] 7.0 Validate and finish
  - [x] 7.1 Run `pnpm check:design` after markup/style changes.
  - [x] 7.2 Run `pnpm validate:web` and inspect Playwright output.
  - [x] 7.3 Run `pnpm validate:backend` after runner/dispatcher changes.
  - [x] 7.4 Manually check Overview, Automations, Schedule, Agents, Boards, Tasks, Runs, Settings, plus automation, agent, board, task, and run detail active states.
  - [x] 7.5 Update `packages/web/DOCS.md` if layout conventions or nav IA changed.
  - [x] 7.6 Update `tasks/CHANGELOG.md` and archive this task to `tasks/done/` when complete.
