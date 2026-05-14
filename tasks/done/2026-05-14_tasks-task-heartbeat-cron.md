# Task Heartbeat Cron Seed

## Completion Summary

Completed explicit task heartbeat cron setup with idempotent install/list/uninstall commands, separate cron markers, safe temp-crontab validation support, setup workspace seeding, web status surfacing, docs, and passing web/backend validation.

## Goal

Add a first-class setup path for the task heartbeat dispatcher. New AgentHQ instances should be seeded with the right local cron entry and agent/config context so `pnpm dispatch:tasks` can periodically find ready assigned tasks and run them with the appropriate agent.

## Notes

- The task heartbeat is separate from per-automation cron.
- Source of truth for open work remains task markdown under `agenthqHome()/projects/*/tasks/*.md`; the DB remains run history/audit.
- The likely default is an instance-local hourly cron that runs `pnpm dispatch:tasks --limit=1` from the repo root.
- The dispatcher itself chooses the task assignee agent; the heartbeat job should not be tied to one product agent personality unless a future tool-mediated setup requires it.
- If we seed an agent/config helper, it should be for operating/observing task dispatch, not for replacing the deterministic dispatcher.

## Relevant Files

- `README.md` - Documents task dispatch and explicit heartbeat cron setup.
- `docs/ARCHITECTURE.md` - Describes the heartbeat dispatcher, cron block, and source-of-truth split.
- `package.json` - Adds task heartbeat cron package scripts.
- `scripts/dispatch-tasks.ts` - CLI entrypoint for the heartbeat command.
- `scripts/cron-utils.ts` - Shared automation and task heartbeat cron helpers.
- `scripts/install-cron.ts` / `scripts/uninstall-cron.ts` / `scripts/list-cron.ts` - Existing cron UX extended by general listing.
- `scripts/install-task-heartbeat-cron.ts` / `scripts/list-task-heartbeat-cron.ts` / `scripts/uninstall-task-heartbeat-cron.ts` - Task heartbeat cron UX.
- `scripts/setup-db.ts` - Seeds workspace directories/docs and points operators to explicit heartbeat setup.
- `packages/web/src/readers.ts` / `packages/web/src/routes.ts` - Surfaces task heartbeat cron status in Overview and Tasks.
- `packages/runner/src/dispatcher.ts` - Heartbeat dispatcher implementation.
- `packages/web/DOCS.md` - Web heartbeat status docs.
- `workspace/agents/README.md` - Agent contract clarifies tasks use each task assignee, not a heartbeat agent.

## Tasks

- [x] 1.0 Define heartbeat setup model
  - [x] 1.1 Decide whether heartbeat cron is installed by default during instance initialization or offered as an explicit setup command. Decision: explicit `pnpm install:task-cron`; `setup:db` only seeds workspace skeleton and points to the command.
  - [x] 1.2 Pick default cadence and limit, likely hourly with `--limit=1`. Decision: default `0 * * * *` with `--limit=1`.
  - [x] 1.3 Define idempotent cron block markers distinct from automation cron blocks, e.g. `agenthq:task-heartbeat`. Decision: `# jumpygoathq:task-heartbeat:start/end`.
  - [x] 1.4 Decide whether heartbeat configuration belongs in `settings.yml`, env vars, or CLI flags. Decision: setup-time CLI flags/env (`--schedule`, `--limit`, `JUMPYGOATHQ_TASK_HEARTBEAT_CRON`, `JUMPYGOATHQ_TASK_DISPATCH_LIMIT`), not `settings.yml`.

- [x] 2.0 Add heartbeat cron commands
  - [x] 2.1 Add install/list/uninstall support for the task heartbeat cron.
  - [x] 2.2 Ensure commands are idempotent and do not disturb per-automation cron blocks.
  - [x] 2.3 Include repo root, `JUMPYGOATHQ_HOME`, and environment handling consistent with automation cron.
  - [x] 2.4 Add clear status output for installed/missing/malformed heartbeat cron.

- [x] 3.0 Seed new instance defaults
  - [x] 3.1 Identify the new-instance setup entrypoint.
  - [x] 3.2 Seed any required directories/docs for tasks/projects if missing.
  - [~] 3.3 Optionally seed an operator/dispatcher agent only if it has a real user-visible purpose. Skipped: no operator agent needed because dispatch is deterministic.
  - [x] 3.4 Document that dispatch uses each task's `assignee` agent rather than a single heartbeat agent.

- [x] 4.0 Surface heartbeat status in UX/docs
  - [x] 4.1 Add heartbeat cron status to the web Overview or Tasks page.
  - [x] 4.2 Update `docs/ARCHITECTURE.md` with heartbeat flow.
  - [x] 4.3 Update relevant package docs or README setup instructions.

- [x] 5.0 Validate and finish
  - [x] 5.1 Test install/list/uninstall against a safe temporary crontab strategy or document manual verification if system crontab is unsafe in CI.
  - [x] 5.2 Run `pnpm validate:backend` if dispatcher/setup behavior changes.
  - [x] 5.3 Update `tasks/CHANGELOG.md` and archive this task when complete.
