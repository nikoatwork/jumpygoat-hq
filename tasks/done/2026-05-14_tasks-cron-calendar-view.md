# Agent Cron Calendar View

## Completion Summary

Completed 2026-05-14. Added a read-only `/schedule` web agenda for scheduled agent runs, deterministic 5-field cron expansion, cron install/orphan/malformed warnings, responsive raw HTML rendering, docs, changelog, and Playwright coverage.

## Goal

After the Agent Entity refactor lands, add a web UI calendar/agenda view that visualizes scheduled agent cron runs and the times they would run. The view should make it obvious which agents are scheduled, which schedules are installed in the user crontab, and when upcoming runs occur without mutating cron state.

## Notes

- **Depends on:** `tasks/todo/tasks-agent-entity.md`. Do not implement this frontend until agents exist and the final agent/scheduled-run contract is settled.
- Use the post-refactor language and data model: agents are the customer-facing runtime entity. If the refactor keeps `automations/<name>.md` as scheduled run files that reference `agent: <agent>`, this view should present them as scheduled agent runs, not as skill-based automations.
- Treat the final agent scheduling files/config as the source of truth for schedules; installed crontab blocks are status/evidence, not the schedule source.
- Include installed AgentHQ cron blocks that no longer match a scheduled agent run as warnings/orphans so the operator can spot drift.
- Do not install, uninstall, or run agents as part of this feature.
- Cron support should match the final post-agent validation: likely `manual` or standard 5-field cron expressions. Complex expressions should be displayed safely even if occurrence expansion is limited.
- Keep the first version server-rendered in the existing raw HTML web app. A React migration is not justified for this feature yet: the interaction model is mostly read-only, the app is local/private, current routes are simple forms/tables, and adding React would introduce a build/runtime surface before there is enough UI complexity to pay for it.
- Revisit React only if the post-agent UI grows into genuinely client-heavy workflows: drag/drop scheduling, live refresh, rich filtering/search across many agents, reusable component state, or a multi-page app that becomes painful to maintain as server-rendered strings.

## Relevant Files

- `tasks/todo/tasks-agent-entity.md` - Prerequisite model migration from skills/automations to agents/scheduled agent runs.
- `packages/web/src/schedule.ts` - Pure 5-field cron parser/expander for the schedule agenda.
- `packages/web/src/readers.ts` - After agent refactor, read agents and scheduled run definitions; extend with cron calendar view data.
- `packages/web/src/routes.ts` - Add the calendar route, nav link, and render agenda/calendar HTML.
- `packages/web/src/html.ts` - Shared layout/nav helpers; add a Calendar/Schedule nav item if route ships.
- `packages/web/public/styles.css` - Calendar/agenda layout styles.
- `packages/web/DOCS.md` - Document the new route and scheduling semantics.
- `docs/ARCHITECTURE.md` - Update web viewer route list and schedule visualization note.
- `scripts/cron-utils.ts` - Existing cron block conventions; update/reuse after agent cron naming is finalized.
- `tests/web/smoke.spec.ts` - Add Playwright coverage for the calendar page.
- `tests/web/schedule.spec.ts` - Focused cron expansion tests and temp-`AGENTHQ_HOME` schedule route coverage.
- `package.json` - `validate:web` now builds the web package before Playwright so dist-backed route/helper tests stay current.

## Tasks

- [x] 0.0 Wait for and align with Agent Entity refactor
  - [x] 0.1 Complete or re-review `tasks/todo/tasks-agent-entity.md` before implementation. Completed/re-reviewed as `tasks/done/2026-05-14_tasks-agent-entity.md`.
  - [x] 0.2 Confirm final schedule owner: automation markdown files under `agenthqHome()/automations/` reference `agent:` and own `schedule:`.
  - [x] 0.3 Confirm final cron marker naming: installed blocks identify automation/scheduled-run names via `# agenthq:start <automation>` / `# agenthq:end <automation>`.
  - [x] 0.4 Implementation targets still use `automations/` as scheduled agent-run files.

- [x] 1.0 Define the MVP calendar behavior
  - [x] 1.1 Route is `GET /schedule`.
  - [x] 1.2 Default time window is the next 7 days, rendered as a grouped agenda plus summary table.
  - [x] 1.3 Manual automations are excluded from occurrence expansion and shown in a separate manual section.
  - [x] 1.4 Cron drift is shown as warnings for scheduled-not-installed, installed-without-source/orphan, and malformed AgentHQ blocks.

- [x] 2.0 Build deterministic schedule expansion helpers
  - [x] 2.1 Add a pure helper for parsing 5-field cron strings into allowed minute/hour/day/month/week sets.
  - [x] 2.2 Add `nextOccurrences(schedule, from, until, limit)` with deterministic local-time behavior.
  - [x] 2.3 Support numbers, `*`, lists, ranges, and step expressions accepted by final validation (`*/15`, `1-5`, `1,3,5`, etc.).
  - [x] 2.4 Return a safe warning instead of throwing for unsupported or malformed expressions.
  - [x] 2.5 Add focused tests for daily, weekly, hourly, list/range/step, no-match, and malformed cron cases.

- [x] 3.0 Add web reader/view models for scheduled agent runs
  - [x] 3.1 Add a dedicated view model with scheduled run name/id, agent name, schedule, model/default model, install status, warnings, and upcoming occurrences.
  - [x] 3.2 Reuse/update `listInstalledCronBlocks()` to compute installed status by automation identifier.
  - [x] 3.3 Detect orphan installed blocks that do not map to a current scheduled agent run.
  - [x] 3.4 Include agent description metadata without loading context files.
  - [x] 3.5 Keep this read-only; no cron mutation from the calendar view.

- [x] 4.0 Render the calendar/agenda page in the raw HTML UI
  - [x] 4.1 Add the route and nav link.
  - [x] 4.2 Render an upcoming agenda grouped by date/time with scheduled run name, agent name, cron expression, and installed status.
  - [x] 4.3 Render a compact per-agent/per-scheduled-run summary: next run, upcoming count in window, manual/malformed status, installed yes/no.
  - [x] 4.4 Render warnings for missing crontab install, orphan installed blocks, and unsupported cron syntax.
  - [x] 4.5 Add minimal responsive CSS; avoid client-side framework dependencies.

- [x] 5.0 Validate behavior
  - [x] 5.1 Add Playwright smoke coverage for the new page using a temporary `AGENTHQ_HOME` with representative scheduled/manual agent runs.
  - [x] 5.2 Verify the page renders when `crontab -l` is unavailable or empty via the reader fallback path and Playwright route coverage.
  - [x] 5.3 Verify no cron state changes during tests or validation; tests only read `crontab -l` and never call write/install helpers.
  - [x] 5.4 Run `pnpm validate:web` and inspect Playwright output before claiming success. Passed: 14/14 tests.

- [x] 6.0 Update docs and closeout
  - [x] 6.1 Update `packages/web/DOCS.md` with the calendar route and read-only schedule semantics.
  - [x] 6.2 Update `docs/ARCHITECTURE.md` web viewer route list.
  - [x] 6.3 Add a changelog entry in `tasks/CHANGELOG.md` when implemented.
  - [x] 6.4 Archive this task to `tasks/done/YYYY-MM-DD_tasks-cron-calendar-view.md` when complete.

## Decisions

- Implement after agents exist, not against the current skill-based UI.
- Present schedules as agent cron runs in the UI, even if the backing source remains scheduled-run/automation markdown that references an agent.
- Start without React. Server-rendered HTML plus a pure schedule-expansion helper is the lowest-risk path and fits the current architecture.
- Calendar MVP should be read-only visualization, not cron install/uninstall management.
