# CLI and Unified CRUD API

## Goal

Create a shared domain/service layer so the web UI, JSON API, and `jumpygoathq` CLI can perform the same CRUD operations against the hosted jumpyGoatHQ instance. The CLI should ship from this monorepo and support local development via `pnpm --filter @jumpygoat-hq/cli link --global`, with optional remote mode for talking to a VPS-hosted API.

## Completion Summary

Completed on 2026-05-14. Added `@jumpygoat-hq/core`, `/api/...` JSON routes with optional bearer-token auth, and `@jumpygoat-hq/cli` with local core mode, remote API mode, and named instance profiles. Updated docs and validated with `pnpm validate`, `pnpm build`, and core tests.

## Notes

- API routes should use `/api/...`, not `/api/v1/...`.
- CLI ships as `packages/cli` in this repo; no npm publishing is required for the initial implementation.
- Default CLI mode can call local core services directly; remote mode should use `--api-url`, `JUMPYGOATHQ_API_URL`, or a named per-instance profile.
- Files remain source of truth for agents, automations, boards, tasks, and settings; runs remain SQLite.
- Cron is setup/evidence only, not a second schedule model.
- Keep the web UI minimal/raw HTML; route handlers should delegate product rules to shared core services.

## Relevant Files

- `docs/ARCHITECTURE.md` - Implemented architecture and API/client boundaries.
- `packages/core/` - Shared domain package with DTOs, errors, service contracts, safe-name helpers, file-backed CRUD services, cron status/setup wrappers, docs, and core tests.
- `packages/web/src/actions.ts` - HTML form parsing plus adapters that delegate validation/mutations to `packages/core`.
- `packages/web/src/readers.ts` - Web view readers that delegate agents, automations, boards, tasks, and cron status to `packages/core`.
- `packages/cli/` - `jumpygoathq` CLI package with local core mode, remote API mode, named instance profiles, CRUD commands, and development docs.
- `packages/web/src/api.ts` - Thin JSON `/api/...` adapter over `packages/core` with structured JSON errors.
- `packages/web/src/index.ts` - HTTP request body parsing for form and JSON API requests.
- `packages/web/src/routes.ts` - HTML adapter plus API delegation.
- `packages/runner/src/` - Existing runner/domain runtime utilities.
- `packages/shared/` - Current pure shared helpers; keep side effects out unless intentionally reorganized.
- `.env.example` - Documents optional `JUMPYGOATHQ_API_TOKEN` for protected remote API use.
- `packages/cli/DOCS.md` - CLI install, mode, instance profile, token, SSH tunnel, and Tailscale usage notes.
- `packages/web/DOCS.md` - JSON API auth, remote CLI examples, and side-effect audit notes.
- `packages/web/package.json` - Web package now depends on `@jumpygoat-hq/core`.
- `tests/web/api.spec.ts` - API smoke coverage for CRUD and structured errors.
- `package.json` - Root scripts for build/validation and future CLI dev scripts.
- `pnpm-workspace.yaml` - Workspace package inclusion.
- `tasks/CHANGELOG.md` - Canonical changelog to update when implementation completes.

## Tasks

- [x] 1.0 Define shared core service boundary
  - [x] 1.1 Create `packages/core` package skeleton with TypeScript config and package metadata.
  - [x] 1.2 Define service modules for agents, automations, boards, tasks, settings, runs, and cron.
  - [x] 1.3 Define common result/error types for validation, not found, conflict, and unsafe-name failures.
  - [x] 1.4 Define DTO shapes that include parsed fields, raw markdown where supported, warnings, mtime/updatedAt, and revision/etag metadata.

- [x] 2.0 Move file-backed CRUD rules into core
  - [x] 2.1 Extract safe-name validation and path-safe assertions from web actions into core.
  - [x] 2.2 Extract automation read/create/update/delete and canonical markdown serialization into core.
  - [x] 2.3 Extract agent read/create/update/delete and delete-reference guards into core.
  - [x] 2.4 Extract board/task read/create/update/status/delete operations into core.
  - [x] 2.5 Extract settings read/update validation into core.
  - [x] 2.6 Extract run listing/detail readers from SQLite into core.
  - [x] 2.7 Extract cron status parsing and install/uninstall wrappers into core without creating a separate schedule source of truth.
  - [x] 2.8 Add core tests for validation, serialization, delete guards, and optimistic overwrite behavior.

- [x] 3.0 Adapt web UI to shared core
  - [x] 3.1 Replace direct product-rule logic in `packages/web/src/actions.ts` with calls to `packages/core`.
  - [x] 3.2 Replace direct reader logic in `packages/web/src/readers.ts` with core service calls where practical.
  - [x] 3.3 Preserve existing HTML routes, POST + redirect behavior, and raw HTML design constraints.
  - [x] 3.4 Ensure web form errors can map from shared structured core errors.
  - [x] 3.5 Run `pnpm validate:web` and fix regressions.

- [x] 4.0 Add JSON API adapter
  - [x] 4.1 Decide whether API routes live in `packages/web` or a separate `packages/api` package for the first implementation. Decision: first implementation lives in `packages/web` as thin `/api/...` routes over `packages/core`; split to `packages/api` later only if needed.
  - [x] 4.2 Implement `/api/agents` list/create and `/api/agents/:name` get/update/delete.
  - [x] 4.3 Implement `/api/automations` list/create and `/api/automations/:name` get/update/delete.
  - [x] 4.4 Implement `POST /api/automations/:name/runs` for run-now dispatch.
  - [x] 4.5 Implement `/api/boards`, `/api/tasks`, and nested board task routes.
  - [x] 4.6 Implement `/api/runs`, `/api/settings`, and `/api/cron` status/setup routes.
  - [x] 4.7 Return deterministic JSON errors with `code`, `message`, and optional `fields`.
  - [x] 4.8 Add API smoke tests for create/read/update/delete flows.

- [x] 5.0 Add CLI package
  - [x] 5.1 Create `packages/cli` package with a `jumpygoathq` bin.
  - [x] 5.2 Support local mode that calls `packages/core` directly.
  - [x] 5.3 Support remote mode via `--api-url` and `JUMPYGOATHQ_API_URL`.
  - [x] 5.4 Add config commands for local CLI settings, including named per-instance profiles, API URL, and token storage strategy.
  - [x] 5.5 Implement `agents list/view/create/update/delete` commands.
  - [x] 5.6 Implement `automations list/view/create/update/delete/run` commands.
  - [x] 5.7 Implement `boards`, `tasks`, `runs`, `settings`, and `cron` commands.
  - [x] 5.8 Document local development install with `pnpm --filter @jumpygoat-hq/cli link --global`.

- [x] 6.0 Secure remote VPS operation
  - [x] 6.1 Keep API bind default local-only unless explicitly configured.
  - [x] 6.2 Add API token support for remote use behind HTTPS/proxy/Tailscale/SSH tunnel.
  - [x] 6.3 Ensure secrets and provider env vars are never returned by API endpoints.
  - [x] 6.4 Add audit/logging for side-effecting API calls such as run-now and cron install/uninstall.
  - [x] 6.5 Document remote usage examples for HTTPS, SSH tunnel, Tailscale, and named instance profiles.

- [x] 7.0 Validate and document end-to-end workflow
  - [x] 7.1 Add root build/check scripts for the new core/API/CLI packages.
  - [x] 7.2 Run `pnpm validate:web` after web/API changes.
  - [x] 7.3 Run `pnpm validate:backend` after runner/core integration changes.
  - [x] 7.4 Run `pnpm validate` for broad confidence.
  - [x] 7.5 Update `docs/ARCHITECTURE.md` and package docs with final implemented command/API details.
  - [x] 7.6 Update `tasks/CHANGELOG.md` and archive this task to `tasks/done/` when complete.
