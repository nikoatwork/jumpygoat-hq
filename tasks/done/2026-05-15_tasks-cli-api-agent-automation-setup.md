# Easier Agent + Automation Setup API/CLI

## Completion Summary

Completed 2026-05-15. Added reliable cron installation with generated short shell scripts, rich automation frontmatter preservation, idempotent agent/automation upsert APIs, one-shot setup, automation status, CLI apply/setup/status commands, documentation, and local/remote validation.

## Goal

Make jumpyGoatHq setup flows as easy as: create/update an agent, create/update an automation, run it once now, install its schedule, and inspect status/recent runs through simple HTTP and CLI calls. Remove the current operational footguns around create-vs-update, cron install, connector config, and status inspection.

## Notes

- Desired API shape should support one-shot setup with idempotent behavior.
- CLI should be a thin wrapper over the same API/core services.
- Automations need to preserve connector frontmatter like Firecrawl and Resend email config.
- Fix cron install first; current remote cron install failed due to top-level await / CJS transform in `scripts/install-cron.ts`.

## Relevant Files

- `packages/web/src/api.ts` - HTTP API routes for agents, automations, cron, runs, and new setup/status endpoints.
- `packages/core/src/services/automations.ts` - Automation create/update preserves supported rich frontmatter (`web`, `notify`, `model`) and accepts raw markdown input.
- `packages/core/src/dto.ts` - Automation DTO includes connector config summaries for API/CLI consumers.
- `packages/core/src/services/cron.ts` - Cron service wrapper and status parsing.
- `scripts/install-cron.ts` - Failing cron installer script.
- `scripts/uninstall-cron.ts` - Check for same top-level-await/runtime issue.
- `scripts/install-task-heartbeat-cron.ts` - Audited cron installer script for the same TSX/CJS runtime pattern.
- `scripts/uninstall-task-heartbeat-cron.ts` - Audited cron uninstaller script for the same TSX/CJS runtime pattern.
- `tests/web/cron-scripts.spec.ts` - Regression coverage for cron install/uninstall scripts under TSX with an isolated crontab.
- `tests/web/api.spec.ts` - API regression coverage for rich frontmatter, upserts, setup, and status responses.
- `packages/core/test/core.test.ts` - Updated automation markdown expectation for YAML stringification.
- `packages/cli/src/index.ts` - Added idempotent apply/setup commands, automation status, prompt-file/setup-file parsing, and clearer unreachable-instance errors.
- `packages/cli/package.json` - Adds `js-yaml` for setup/automation YAML files.
- `pnpm-lock.yaml` - Locks the new CLI YAML parser dependency.
- `packages/cli/DOCS.md` - Documents idempotent apply/setup/status commands and troubleshooting.
- `packages/web/DOCS.md` - Documents upsert/setup/status API endpoints, JSON examples, cron helpers, and troubleshooting.
- `packages/runner/src/automation.ts` - Ensure richer automation frontmatter remains compatible with runner loading.
- `packages/runner/src/connectors/*` - Connector config expectations for Firecrawl and Resend.

## Tasks

- [x] 1.0 Fix cron installation reliability
  - [x] 1.1 Refactor `scripts/install-cron.ts` to avoid top-level `await` and wrap execution in `main()`.
  - [x] 1.2 Audit cron scripts for the same TSX/CJS transform issue and fix consistently.
  - [x] 1.3 Add or update tests covering cron install/uninstall script execution.
  - [x] 1.4 Confirm `jumpygoathq cron install-automation <name>` works against local and remote instances. Local confirmed with isolated CLI config/crontab; remote confirmed on `eu-ai-pm-remote-weekly` after shortening installed cron lines via generated scripts.

- [x] 2.0 Preserve rich automation frontmatter
  - [x] 2.1 Extend automation create/update input to accept optional connector/config blocks such as `web`, `notify`, and `model` without dropping them.
  - [x] 2.2 Add a raw-content or structured-frontmatter path for automation upserts.
  - [x] 2.3 Ensure existing simple automation create/update behavior remains straightforward.
  - [x] 2.4 Add tests that a Resend `notify.email.to` and Firecrawl config survive create/update.

- [x] 3.0 Add idempotent agent and automation upsert APIs
  - [x] 3.1 Add `PUT /api/agents/:name` behavior that can create when missing and update when present, or add an explicit `?upsert=1` mode.
  - [x] 3.2 Add `PUT /api/automations/:name` upsert behavior with schedule, prompt, agent, and connector config.
  - [x] 3.3 Return stable JSON including `created`, `updated`, path, etag, and validation errors.
  - [x] 3.4 Add tests for create, update, validation failure, and idempotent re-apply.

- [x] 4.0 Add one-shot setup endpoint
  - [x] 4.1 Add `POST /api/setup/automation` accepting `{ agent, automation, installCron, runNow }`.
  - [x] 4.2 Implement transactional-ish behavior: create/update agent, create/update automation, install cron if requested, run once if requested.
  - [x] 4.3 Return `{ agent, automation, cron, run }` with useful warnings if cron install or run fails.
  - [x] 4.4 Audit side effects with existing API audit logging.

- [x] 5.0 Add automation status endpoint
  - [x] 5.1 Add `GET /api/automations/:name/status` returning automation metadata, cron install state, recent runs, and warnings.
  - [x] 5.2 Support `?limit=N` for recent runs.
  - [x] 5.3 Include connector/action summaries where available without dumping large trace text by default.
  - [x] 5.4 Add tests for installed cron, missing cron, recent successful run, and failed run.

- [x] 6.0 Improve CLI ergonomics
  - [x] 6.1 Add `jumpygoathq agents apply <name> --file AGENT.md` as create-or-update.
  - [x] 6.2 Add `jumpygoathq automations apply <name> --agent ... --schedule ... --prompt/--prompt-file ... --install-cron --run-now`.
  - [x] 6.3 Add `jumpygoathq setup automation --file setup.json|yaml --install-cron --run-now` wrapping `POST /api/setup/automation`.
  - [x] 6.4 Add `jumpygoathq automations status <name> --limit 5` wrapping the status endpoint.
  - [x] 6.5 Improve error messages for unreachable default instances and suggest `jumpygoathq instances list/use`.

- [x] 7.0 Documentation and examples
  - [x] 7.1 Add API examples for the three-call flow: setup agent, setup automation, run now.
  - [x] 7.2 Add one-shot setup JSON example for a Firecrawl + Resend email automation.
  - [x] 7.3 Update CLI docs with idempotent apply/setup commands.
  - [x] 7.4 Add troubleshooting notes for Tailscale/default instance, cron PATH, and email `from` config.

- [x] 8.0 Validation
  - [x] 8.1 Run `pnpm validate:backend` after backend/CLI changes.
  - [x] 8.2 Run targeted API/CLI smoke tests for agent apply, automation apply, run now, cron install, and status.
  - [x] 8.3 Update `tasks/CHANGELOG.md` when implemented.
  - [x] 8.4 Archive this task to `tasks/done/` when complete.

## Validation Notes

- **2026-05-15:** `pnpm validate:web` passed after documentation updates (31 Playwright tests).
- **2026-05-15:** `pnpm validate:backend` passed after backend/API changes; no backend rerun needed for docs-only changes.
- **2026-05-15:** CLI build passed after apply/setup/status implementation.
- **2026-05-15:** Local CLI smoke passed for `agents apply`, `automations apply --install-cron`, `automations status`, `setup automation --file setup.yaml --install-cron`, and `automations apply --run-now`.
- **2026-05-15:** Remote CLI smoke passed for `automations status eu-ai-pm-remote-weekly --limit 1`; remote cron install idempotency was already confirmed after `f20cd95`.
- **2026-05-15:** `pnpm validate:backend` passed after CLI changes.

## Blockers

- **2026-05-15:** Remote cron confirmation blocker resolved after deploying `f20cd95`; `jumpygoathq cron install-automation eu-ai-pm-remote-weekly` succeeds and remains idempotent with one installed block.
