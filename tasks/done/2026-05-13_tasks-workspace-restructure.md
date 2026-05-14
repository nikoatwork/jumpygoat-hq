# Workspace Restructure — Core vs Mutable State

## Completion Summary

Completed on 2026-05-13. Mutable operator state now lives under `agenthqHome()` (`workspace/` locally by default, or `AGENTHQ_HOME` in deployment), with shared path helpers, updated runner/web/scripts, pointer stubs for legacy top-level dirs, canonical workspace READMEs, docs updates, and passing build/web/backend validation.

## Goal

Restructure agenthq before deployment so source code stays separate from mutable operator state. The local repo should keep core code in the root/packages and move active automations, skills, run DB, traces, and per-automation working dirs under a single mutable `workspace/` root. Deployments can point `AGENTHQ_HOME` at an external mounted workspace.

## Notes

- This should happen before the Pi chat gateway work.
- `workspace/` is the local default mutable root.
- `AGENTHQ_HOME` overrides the local default for deployment.
- Canonical deployment layout: `AGENTHQ_HOME/{automations,skills,data,workspaces,traces}`.
- Canonical local layout: `workspace/{automations,skills,data,workspaces,traces}`.
- The name `workspace/workspaces` is awkward but intentional for now: top-level `workspace/` is the mutable instance home; nested `workspaces/<automation>/` preserves the existing per-automation Pi cwd concept.
- Since the system is not deployed yet, prefer the clean break over long-lived compatibility complexity. Keep migration/backward compatibility only where it is cheap and reduces local data loss risk.

## Relevant Files

- `packages/shared/paths.js` - Shared repo/workspace path helper implementation.
- `packages/shared/paths.d.ts` - Type declarations for shared path helpers.
- `packages/shared/package.json` - Marks shared helper files as ESM for tsx/node resolution.
- `packages/runner/src/paths.ts` - Current runner path helpers for automations, skills, traces, and per-automation workspaces.
- `packages/runner/src/db.ts` - Current DB path resolution.
- `packages/web/src/paths.ts` - Current web path helpers for automations, skills, and DB.
- `packages/web/src/actions.ts` - Web mutation paths and `runNow` cwd.
- `packages/web/src/readers.ts` - Web readers for automations, skills, and DB.
- `scripts/smoke-runner.ts` - Smoke fixture paths and DB path.
- `scripts/cron-utils.ts` - Cron log path.
- `scripts/setup-db.ts` - DB setup path reporting.
- `scripts/doctor.ts` - Path diagnostics.
- `.gitignore` - Runtime/template ignore rules.
- `.env.example` - Template comments for workspace and DB path overrides.
- `README.md` - User-facing setup/path documentation.
- `docs/ARCHITECTURE.md` - Canonical architecture and runtime path docs.
- `docs/DEPLOY.md` - Deployment path and systemd/cron docs.
- `packages/web/DOCS.md` - Web package path docs.
- `AGENTS.md` - Agent map and hard constraints.
- `automations/README.md` - Move or replace with a pointer stub.
- `skills/README.md` - Move or replace with a pointer stub.
- `workspace/automations/README.md` - Canonical local mutable automation docs.
- `workspace/skills/README.md` - Canonical local mutable skill docs.

## Tasks

- [x] 1.0 Decide and encode the workspace path model
  - [x] 1.1 Confirm local default: `AGENTHQ_HOME` unset means `repoRoot()/workspace`.
  - [x] 1.2 Confirm deployment override: `AGENTHQ_HOME=/path` means mutable state lives directly under that path.
  - [x] 1.3 Confirm canonical dirs: `automations/`, `skills/`, `data/`, `workspaces/`, and `traces/` under `agenthqHome()`.
  - [x] 1.4 Decide whether to keep top-level `automations/` and `skills/` as pointer stubs or remove them.

- [x] 2.0 Centralize path helpers
  - [x] 2.1 Add shared path helpers for `repoRoot()`, `agenthqHome()`, `automationsDir()`, `skillsDir()`, `dataDir()`, `workspacesDir()`, `workspaceDir(name)`, `tracesDir()`, and `dbPath()`.
  - [x] 2.2 Use the same helper implementation from runner, web, and scripts instead of duplicating path logic.
  - [x] 2.3 Keep `AGENTHQ_DB_PATH` as an explicit DB override for advanced/local testing.
  - [x] 2.4 Ensure relative `AGENTHQ_DB_PATH` resolves against `agenthqHome()`, not repo root.

- [x] 3.0 Move runtime/file paths to workspace
  - [x] 3.1 Update runner automation loading to read `agenthqHome()/automations/<name>.md`.
  - [x] 3.2 Update runner skill loading to read `agenthqHome()/skills/<name>/SKILL.md`.
  - [x] 3.3 Update runner Pi cwd to `agenthqHome()/workspaces/<automation>/`.
  - [x] 3.4 Update trace writing to `agenthqHome()/traces/`.
  - [x] 3.5 Update default SQLite path to `agenthqHome()/data/agenthq.sqlite`.
  - [x] 3.6 Update cron logs to `agenthqHome()/data/cron-<automation>.log`.

- [x] 4.0 Update web and scripts
  - [x] 4.1 Update web readers/actions to use workspace automations and skills dirs.
  - [x] 4.2 Update web dashboard/path display to show `AGENTHQ_HOME` and DB path clearly.
  - [x] 4.3 Update `runNow` to execute from repo root while reading/writing mutable state through `AGENTHQ_HOME`.
  - [x] 4.4 Update smoke runner fixture creation/removal to use workspace dirs.
  - [x] 4.5 Update doctor/setup scripts to report the workspace root and default DB path.

- [x] 5.0 Move template directories and ignore rules
  - [x] 5.1 Create `workspace/automations/README.md` and `workspace/skills/README.md` as the canonical docs for local mutable files.
  - [x] 5.2 Move or rewrite top-level `automations/README.md` and `skills/README.md` as pointer stubs, or remove them if docs are clear elsewhere.
  - [x] 5.3 Update `.gitignore` to ignore active workspace state while allowing README stubs/docs to be committed.
  - [x] 5.4 Ensure `.env`, `.env.local`, runtime DBs, traces, test results, and Pi workspaces remain gitignored.

- [x] 6.0 Update docs
  - [x] 6.1 Update `README.md` setup/create/run sections for `workspace/` and `AGENTHQ_HOME`.
  - [x] 6.2 Update `docs/ARCHITECTURE.md` concepts and runtime flow paths.
  - [x] 6.3 Update `docs/DEPLOY.md` with an external `AGENTHQ_HOME` volume recommendation.
  - [x] 6.4 Update `packages/web/DOCS.md` safety/path constraints.
  - [x] 6.5 Update `AGENTS.md` hard constraints and package docs references.

- [x] 7.0 Validate
  - [x] 7.1 Run `pnpm build`.
  - [x] 7.2 Run `pnpm validate:web` and inspect Playwright output.
  - [x] 7.3 Run `pnpm validate:backend` if local Pi auth/provider availability is expected.
  - [x] 7.4 Manually verify that creating a skill and automation through the web UI writes under `workspace/`.
  - [x] 7.5 Manually verify that `AGENTHQ_HOME=/tmp/agenthq-test pnpm ...` uses the external workspace.

## Validation Notes

- **2026-05-13:** `pnpm build`, `pnpm validate:web`, and `pnpm validate:backend` passed.
- **2026-05-13:** Verified web create flows write skills/automations under a temporary `AGENTHQ_HOME` workspace and verified `AGENTHQ_HOME=/tmp/... pnpm setup:db` writes SQLite under the external workspace.

## Changelog

- **2026-05-13:** Updated `tasks/CHANGELOG.md`; implementation complete and archived.
