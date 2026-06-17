# CLI API-Only Contract

## Goal

Make the HTTP JSON API the single supported contract for the CLI. Remove the CLI's direct local `@jumpygoat-hq/core` execution path so every CLI operation goes through the same API used by remote deployments, with `http://127.0.0.1:3000` as the default local target.

## Completion Summary

Completed on 2026-06-17. The CLI now uses the HTTP JSON API only, defaults to `http://127.0.0.1:3000`, retains named instances as saved API targets, removes the direct `@jumpygoat-hq/core` dependency, and has a localhost CLI/API smoke covering CRUD plus settings/runs/cron/setup paths.

## Notes

- Decision: the API is the source of truth contract; the CLI is a thin API client, not another mutation path.
- Decision: keep named instances because they are only saved API targets/tokens for local/VPS/multiple boxes.
- Decision: default CLI target should be `http://127.0.0.1:3000`; if unreachable, print concise instructions to start the dev/web server or configure `--api-url`/`--instance`.
- Decision: convert full CLI functionality, not only CRUD: agents, automations, boards, tasks, runs, settings, cron, run-now, automation status, and setup.
- Desired cleanup: reduce net code/docs where possible by deleting local-mode duplication and condensing architecture/docs around one API contract.
- Web UI manual testing is out of scope for this task; API + CLI verification is in scope.

## Relevant Files

- `packages/cli/src/index.ts` - Remove local core imports/branches and make commands call API only.
- `packages/cli/DOCS.md` - Update CLI docs around API-only behavior, localhost default, and named instances.
- `packages/cli/QUICKSTART.md` - Update quickstart to start/use the local API server.
- `packages/web/src/api.ts` - Ensure all CLI-needed operations are available through API routes and deterministic errors.
- `packages/core/src/services/*.ts` - Keep as server-side domain implementation; simplify only where removing CLI-local affordances exposes dead code.
- `packages/core/src/dto.ts` - Keep DTOs aligned with API responses used by CLI.
- `docs/ARCHITECTURE.md` - Make API-as-contract explicit for future features.
- `packages/web/DOCS.md` - Keep JSON API examples aligned with CLI API-only stance.
- `tests/web/api.spec.ts` - Existing API coverage to preserve/extend if needed.
- `tests/` or `scripts/` - Add CLI-over-localhost smoke coverage.

## Edited Files

- `packages/cli/src/index.ts`
- `packages/cli/package.json`
- `pnpm-lock.yaml` - stage only the CLI dependency-removal hunk; other existing lockfile hunks appear unrelated.
- `scripts/smoke-cli-api.ts`
- `package.json`
- `docs/ARCHITECTURE.md`
- `packages/cli/DOCS.md`
- `packages/cli/QUICKSTART.md`
- `packages/web/DOCS.md`
- `tasks/done/2026-06-17_tasks-cli-api-only.md`
- `tasks/CHANGELOG.md`

## Tasks

- [x] 1.0 Establish the API-only CLI architecture
  - [x] 1.1 Update `docs/ARCHITECTURE.md` so future features follow: CLI -> HTTP JSON API -> core/domain services -> files/SQLite/cron.
  - [x] 1.2 Remove/replace wording that describes CLI local mode as a supported default path.
  - [x] 1.3 Document named instances as saved API targets only, not alternate execution modes.
  - [x] 1.4 Clarify that `packages/core` remains server/domain internals, not a public CLI integration surface.

- [x] 2.0 Refactor CLI to be an API wrapper only
  - [x] 2.1 Remove direct imports of `@jumpygoat-hq/core` from `packages/cli/src/index.ts`.
  - [x] 2.2 Remove local/remote client branching and replace it with a single HTTP client path.
  - [x] 2.3 Default API URL resolution to `http://127.0.0.1:3000` when no `--api-url`, `JUMPYGOATHQ_API_URL`, or named instance is selected.
  - [x] 2.4 Preserve `--api-url`, `--token`, `--instance`, `JUMPYGOATHQ_API_URL`, `JUMPYGOATHQ_TOKEN`, and `JUMPYGOATHQ_INSTANCE` behavior as API target selection.
  - [x] 2.5 Improve unreachable-server errors to say how to start the local server and how to configure/select an instance.
  - [x] 2.6 Keep `--json` output stable for scripts.

- [x] 3.0 Ensure all CLI functionality exists through API routes
  - [x] 3.1 Verify agents CRUD maps to `/api/agents` routes.
  - [x] 3.2 Verify automations CRUD, `run`, `status`, and setup map to `/api/automations`, `/api/automations/:name/runs`, `/api/automations/:name/status`, and `/api/setup/automation`.
  - [x] 3.3 Verify boards CRUD maps to `/api/boards` routes.
  - [x] 3.4 Verify tasks CRUD/status maps to `/api/tasks` and `/api/boards/:board/tasks/:task` routes.
  - [x] 3.5 Verify runs list/view maps to `/api/runs` routes.
  - [x] 3.6 Verify settings view/update maps to `/api/settings` routes.
  - [x] 3.7 Verify cron status/install/uninstall maps to `/api/cron` routes, including task heartbeat.
  - [~] 3.8 Add missing API routes only if a CLI command still requires direct local behavior. - Skipped: existing API routes covered the CLI.

- [x] 4.0 Simplify dead or duplicated code
  - [x] 4.1 Delete CLI-local helper functions that duplicate API/core behavior, including local upsert/status/setup summaries where no longer needed.
  - [x] 4.2 Remove CLI-local DTO/service type imports and any now-unused dependency edges from `packages/cli/package.json` if applicable.
  - [x] 4.3 Review `packages/core` for functions/types that existed only for CLI local mode and remove or internalize them when safe.
  - [x] 4.4 Prefer deleting duplicated response-shaping code over adding new abstraction layers.
  - [x] 4.5 Keep the refactor pre-release-breaking where it clarifies primitives; do not preserve local mode for compatibility.

- [x] 5.0 Add CLI-over-localhost verification
  - [x] 5.1 Add an automated smoke test/script that starts the web/API server against a temporary `JUMPYGOATHQ_HOME` and temporary port.
  - [x] 5.2 In the smoke, run the built CLI against the localhost API and exercise agent create/list/view/update/delete.
  - [x] 5.3 Exercise automation create/list/view/update/status/delete through the CLI.
  - [x] 5.4 Exercise board create/list/view/update/delete through the CLI.
  - [x] 5.5 Exercise task create/list/view/status/update/delete through the CLI.
  - [x] 5.6 Exercise settings view/update, runs list, and cron status through the CLI where safe without installing real user cron.
  - [x] 5.7 Use a temp crontab file or mocked env for cron install/uninstall smoke coverage if feasible.
  - [x] 5.8 Ensure the smoke fails if the CLI accidentally uses local files without the API server.

- [x] 6.0 Update user-facing CLI/API docs
  - [x] 6.1 Update `packages/cli/DOCS.md` and `packages/cli/QUICKSTART.md` to remove local-mode instructions.
  - [x] 6.2 Show the local workflow: start `pnpm dev:web`/`pnpm web`, then run `jumpygoathq ...` against default localhost.
  - [x] 6.3 Keep remote/VPS examples with named instances and tokens.
  - [x] 6.4 Condense duplicated API examples where possible and point to the API contract as the source of truth.
  - [x] 6.5 Update any stale docs that still imply multiple supported CLI execution paths.

- [x] 7.0 Validate and capture completion
  - [x] 7.1 Run `pnpm --filter @jumpygoat-hq/cli build`.
  - [x] 7.2 Run the new CLI-over-localhost smoke test.
  - [x] 7.3 Run existing API/web validation relevant to API behavior, at minimum `pnpm validate:web` unless the task defines a narrower equivalent.
  - [x] 7.4 Confirm the CLI can perform all CRUD operations on localhost with a dev/web server running.
  - [x] 7.5 Update `tasks/CHANGELOG.md` when complete.
  - [x] 7.6 Archive this task file to `tasks/done/<date>_tasks-cli-api-only.md` when complete.

## Verifiable End State

- The CLI no longer imports or calls `@jumpygoat-hq/core` directly.
- All CLI commands use HTTP JSON API calls.
- With the web/API server running on localhost, the CLI can perform CRUD for agents, automations, boards, and tasks.
- The smoke test verifies both the API and CLI path together.
- Architecture and CLI docs clearly state that the API is the contract and the CLI is an API wrapper.
