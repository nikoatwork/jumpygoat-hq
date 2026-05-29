# jumpyGoatHq task changelog

This is the canonical task-level changelog. Completed task files live in `tasks/done/`; do not maintain a separate done-folder changelog.

## 2026-05-29

- feat: added a gated Cloudflare R2 artifact connector with `artifact.upload` / `artifact_upload`, deterministic `runs/<runId>/<filename>` object keys, seven-day presigned download URLs, safe run/agent file path resolution, compact connector audit summaries, docs/context setup guide, doctor diagnostics, and validation (`test:connectors`, `pnpm build`, `doctor`, `validate:web`, `validate:backend`) — completed in `tasks/done/2026-05-29_tasks-r2-artifact-share-links.md`.
- chore: added live connector smoke scripts for Firecrawl, AgentMail, Resend, and local `script.run`, with safe read-only defaults where possible and docs for quick end-to-end revalidation.
- fix: carried automation-level `mail` and `scripts` connector config into runner invocations so AgentMail `mail_send` and local `script_run` tools are exposed for automation runs; validated with AgentMail CLI/live smoke, connector tests, and runner build.
- docs/brand: refreshed the README positioning with the jumpyGoatHq logo/tagline, added AgentMail environment/setup references in `.env.example` and architecture docs, and captured the markdown-native agent-memory architecture research brief in `tasks/research/2026-05-21-agent-memory-architecture.md`.
- feat: added the gated local `script.run` connector for allowlisted agent-bundled TypeScript scripts, with runner schema/resolution, Pi tool registration, path/symlink safety checks, bounded execution/output, trace summaries, core/API preservation, docs, examples, and validation (`test:connectors`, `pnpm build`, `validate:web`, `validate:backend`) — completed in `tasks/done/2026-05-29_tasks-script-run-connector.md`.

## 2026-05-15

- feat: added dependency-free VPS operational JSONL logging for web, API audit, runner, Pi subprocesses, cron wrappers, and SSH troubleshooting docs — completed in `tasks/done/2026-05-15_tasks-lightweight-vps-logging.md`.
- feat: added idempotent agent/automation setup APIs, one-shot automation setup, automation status, rich connector frontmatter preservation, reliable cron install scripts, CLI apply/setup/status commands, docs, and validation — completed in `tasks/done/2026-05-15_tasks-cli-api-agent-automation-setup.md`.
- feat: completed the frontend UX audit improvement pass with product/design context, quieter OKLCH web styling, larger/labeled controls, responsive table/kanban guardrails, expanded web tests, and validation; completed in `tasks/done/2026-05-15_tasks-frontend-ux-audit.md`.
- feat: redesigned the Agents page roster as profile-style team cards with deterministic emoji avatars, compact workload stats, and no explainer section — completed in `tasks/done/2026-05-15_tasks-agent-roster-profile-cards.md`.

## 2026-05-14

- feat: added shared core CRUD services, `/api/...` JSON routes with token support, and a local/remote `jumpygoathq` CLI with named instance profiles — completed in `tasks/done/2026-05-14_tasks-cli-api-unified-crud.md`.
- feat: finalized the web sidebar IA with grouped navigation, footer Settings, route copy/docs, invocation/run cleanup, active-state smoke coverage, and manual detail-page checks — completed in `tasks/done/2026-05-14_tasks-sidebar-ia.md`.
- feat: added explicit task heartbeat cron setup/list/uninstall commands, safe temp-crontab support, setup workspace seeding, heartbeat web status, docs, and validation — completed in `tasks/done/2026-05-14_tasks-task-heartbeat-cron.md`.
- feat: renamed project/task kanban to boards, switched task statuses to `not-yet`/`ready`/`working-on-it`/`done`, added focused `?status=` task view, updated docs, and validated web/backend — completed in `tasks/done/2026-05-14_tasks-boards-focused-kanban.md`.
- chore: removed remaining legacy runtime concept compatibility from runtime/web/docs, including the old run column/backfill, file pointers, gitignore contracts, and UI fallbacks — completed in `tasks/done/2026-05-14_tasks-remove-skills.md`.
- docs/runtime: clarified jumpyGoatHq bundle/tool/invocation/run boundaries, documented reserved agent resource directories, disabled raw Pi resource/context discovery for runs, and strengthened generated agent run framing — completed in `tasks/done/2026-05-14_tasks-agent-bundle-boundaries.md`.
- feat: added instance-local semantic model profiles, settings UI, runner model resolution audit fields, best-effort Pi usage logging, usage summaries, docs, and tests — completed in `tasks/done/2026-05-14_tasks-semantic-model-profiles-settings.md` with backend smoke passing via Codex subscription (`fast` → `openai-codex/gpt-5.4-mini`).
- feat: added a lightweight raw-HTML web design system with CSS conventions, server-side helpers, stable page refactors, docs, and passing web validation — pending archive from `tasks/todo/tasks-web-design-system.md`.
- feat: added file-backed projects/tasks, a one-task heartbeat dispatcher, raw HTML kanban/status routes, run project/task metadata, docs, and validation — completed in `tasks/done/2026-05-14_tasks-agent-task-queue.md`.
- feat: added read-only web schedule agenda for scheduled agent runs, including 5-field cron expansion, cron install/orphan warnings, docs, and Playwright coverage — completed in `tasks/done/2026-05-14_tasks-cron-calendar-view.md`.
- docs: clarified pre-release strategy around agents as the product primitive, minimal Hermes/OpenClaw-like scope, strong primitives, limited features, and open-source extension seams — see `docs/vision/strategy/agent.md`, `tasks/vision.md`, and `tasks/spec.md`.

## 2026-05-14

- feat: replaced the runtime/UI automation→skill model with automation→agent, adding `agents/<name>/AGENT.md` + ordered context loading, agent-gated connector defaults, Agents web CRUD, smoke fixtures, docs, and validation — completed in `tasks/done/2026-05-14_tasks-agent-entity.md`.

## 2026-05-13

- feat: restructured mutable jumpyGoatHq instance state under `workspace/`/`JUMPYGOATHQ_HOME`, centralizing path helpers and updating runner, web, scripts, docs, and validation — completed in `tasks/done/2026-05-13_tasks-workspace-restructure.md`.

## 2026-05-12

- chore: consolidated task changelog history into canonical `tasks/CHANGELOG.md` and removed the duplicate done-folder changelog.
- feat: completed readable run traces — derived timeline for Pi JSONL traces on web run detail pages, with raw traces retained for debugging — completed in `tasks/done/2026-05-12_tasks-readable-run-traces.md`.

## 2026-05-11

- feat: added a derived readable run timeline for Pi JSONL traces on web run detail pages, keeping raw traces available for debugging.
- feat: added runner-gated Pi connector tools for Firecrawl web actions and Resend email notifications, with connector trace summaries and docs — completed in `tasks/done/2026-05-11_tasks-firecrawl-connector.md`.

## 2026-05-08

- chore: reframed jumpyGoatHq around personal scheduled Pi skills instead of workflow-builder/custom-agent runtime — see `tasks/vision.md`, `tasks/spec.md`.
- feat: built local Pi-backed runner primitive — automation files, Pi skill resolution, SQLite run storage, `.env` loading, Pi-auth-first setup, `doctor` checks, and cron scripts — completed in `tasks/done/2026-05-08_tasks-01-local-mvp.md`.
- feat: built minimal raw HTML web viewer over automations, skills, cron blocks, and SQLite runs, including blocking “Run now” — completed in `tasks/done/2026-05-08_tasks-04-minimal-web.md` and documented in `packages/web/DOCS.md`.
- docs: added architecture/status-quo documentation — see `docs/ARCHITECTURE.md`.
- docs: converted `AGENTS.md` into a concise documentation map plus hard constraints.
- chore: added local self-validating loop for coding agents — Playwright web smoke checks, one Pi-backed backend smoke, and validation skill/docs — completed in `tasks/done/2026-05-08_tasks-self-validating-loop.md`.
- feat: added lean file-native web CRUD for automations and cautious raw skill authoring, with validation and guarded deletes — completed in `tasks/done/2026-05-08_tasks-05-web-crud.md`.
- feat: added v0 connector primitive with Resend email notification parsing/delivery, skill allowed intents, automation opt-in config, and run metadata — completed in `tasks/done/2026-05-08_tasks-04-resend-notifications.md`.


## Current task-list status

- `tasks/done/2026-05-08_tasks-01-local-mvp.md` — closed; Pi/model live smoke was intentionally skipped to avoid token spend.
- `tasks/done/2026-05-08_tasks-04-minimal-web.md` — closed; route/build/manual page checks passed, model-spending run-now verification skipped.
- `tasks/done/2026-05-12_tasks-readable-run-traces.md` — closed; derived trace timeline implemented, docs/tests updated, and web validation completed.
- `tasks/done/2026-05-11_tasks-firecrawl-connector.md` — closed; connector tests, build, backend smoke, and web smoke passed.
- `tasks/done/2026-05-14_tasks-agent-entity.md` — closed; agent entity refactor completed with build, web, backend, connector, web-write, and external `JUMPYGOATHQ_HOME` validation.
- `tasks/done/2026-05-14_tasks-agent-task-queue.md` — closed; file-backed task queue/kanban completed with build, web, backend, manual web-write/kanban/dispatch, and external `JUMPYGOATHQ_HOME` validation.
- `tasks/done/2026-05-14_tasks-sidebar-ia.md` — closed; sidebar IA, active-state fix/coverage, docs, web validation, backend smoke, and manual top-level/detail active-state checks passed.
- `tasks/done/2026-05-14_tasks-task-heartbeat-cron.md` — closed; explicit task heartbeat cron setup completed with safe temp-crontab smoke, web validation, and backend smoke.
- `tasks/done/2026-05-13_tasks-workspace-restructure.md` — closed; workspace restructure completed with build, web, backend, web-write, and external `JUMPYGOATHQ_HOME` validation.
- `tasks/todo/tasks-02-deploy.md` — not started; partly superseded by simpler cron-first deployment direction, but still useful for future VPS hardening/docs.
- `tasks/todo/tasks-03-control-plane.md` — conceptually superseded by `tasks-04-minimal-web.md` for the read-only/minimal viewer; full browser editing remains deferred.
- `tasks/done/2026-05-08_tasks-04-resend-notifications.md` — closed; build, web smoke, backend smoke, real Resend send, and no-notification smoke passed.
- `tasks/done/2026-05-08_tasks-self-validating-loop.md` — closed; build, Playwright web smoke, and Pi-backed backend smoke passed.
- `tasks/done/2026-05-08_tasks-05-web-crud.md` — closed; build, Playwright web smoke, and manual CRUD route/action checks passed.
