# agenthq task changelog

This changelog tracks project work at the task-list level. Completed task-list entries also live in `tasks/done/CHANGELOG.md`.

## 2026-05-08

- chore: reframed agenthq around personal scheduled Pi skills instead of workflow-builder/custom-agent runtime — see `tasks/vision.md`, `tasks/spec.md`.
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
- `tasks/todo/tasks-02-deploy.md` — not started; partly superseded by simpler cron-first deployment direction, but still useful for future VPS hardening/docs.
- `tasks/todo/tasks-03-control-plane.md` — conceptually superseded by `tasks-04-minimal-web.md` for the read-only/minimal viewer; full browser editing remains deferred.
- `tasks/done/2026-05-08_tasks-04-resend-notifications.md` — closed; build, web smoke, backend smoke, real Resend send, and no-notification smoke passed.
- `tasks/done/2026-05-08_tasks-self-validating-loop.md` — closed; build, Playwright web smoke, and Pi-backed backend smoke passed.
- `tasks/done/2026-05-08_tasks-05-web-crud.md` — closed; build, Playwright web smoke, and manual CRUD route/action checks passed.
