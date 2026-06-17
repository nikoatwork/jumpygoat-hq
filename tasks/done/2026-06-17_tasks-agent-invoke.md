# Synchronous Agent Invocation

## Completion summary

Completed 2026-06-17. Added gated synchronous `agent.invoke` / `agent_invoke` child-agent invocation with run lineage, silent child execution, timeout handling, connector audit summaries, API/web lineage exposure, docs, tests, and a real local orchestration automation that invoked `local-file-reviewer` and `git-diff-reviewer` from `repo-strategy-orchestrator`.

Validation passed:

- `pnpm build`
- `pnpm --filter @jumpygoat-hq/runner test:connectors`
- `JUMPYGOATHQ_HOME="$PWD/workspace" pnpm runner repo-strategy-orchestration` — parent run `01KVB0TKC3X6FEJ42D10RMHG0H`; child runs `01KVB0TTBB3KKRJVC9DYZHRAXS` and `01KVB0TTBBWNDC6GFRF772AV1K`
- `pnpm runner repo-strategy-orchestration` against the configured external `JUMPYGOATHQ_HOME` — parent run `01KVB1699S7W81AWX309E2XKRN`; child runs `01KVB16HFBZJM2NWZZY54W0M8X` and `01KVB16HFC2P77HG3YFTH02W6X`
- `pnpm validate:backend`
- `pnpm validate:web`

## Goal

Add a first-scope synchronous `agent.invoke` primitive so a parent Pi agent can call an allowlisted child jumpyGoatHq agent, wait for the child run to finish, and receive a bounded result in-context. Validate it end-to-end with a local orchestration automation that invokes a file-reviewer agent and a git-diff agent, then interprets their responses.

## Notes

- Keep Pi as the runtime; do not build a custom LLM/tool loop.
- Implement `agent.invoke` as a gated jumpyGoatHq connector/domain tool that creates a child `Invocation` and runs the normal runner path.
- Parent agent must declare `allowedIntents: [agent.invoke]` and configure an explicit target-agent allowlist.
- Child invocation resolves only the child agent's own model/defaults/capability policy; do not inherit parent connector permissions.
- Add a small child prompt prefix/frame with parent run metadata and the delegated subtask.
- Protect the parent Pi JSON stream: child execution must not leak stdout/stderr into parent stdout.
- Return bounded child output, status, timing, run id, and error tail; do not return full raw trace by default.
- Workspace is present, but no orchestration demo agents/automation appear to exist yet. Validation should create temporary/local workspace entries only if needed.

## Decisions

- Tool/intent name: `agent.invoke` / `agent_invoke`.
- First implementation is synchronous, not task-dispatch based.
- Child agent permissions stand alone.
- Final validation uses a real local automation run with `pnpm runner <name>`.

## Task 1 findings

- Connector registration is centralized through `packages/runner/src/connectors/pi-extension.ts`; it parses `JUMPYGOATHQ_CONNECTORS_CONFIG_JSON`, creates all known tool definitions, and registers only names present in the resolved plan.
- Connector trace extraction is in `packages/runner/src/connectors/trace.ts`; it depends on `isConnectorToolName`, `TOOL_NAME_TO_INTENT`, and `connectorForTool`, so `agent_invoke` must be added there for audit extraction.
- Run rows are read through both `packages/core/src/services/runs.ts` for API/CLI and `packages/web/src/readers.ts` for server-rendered HTML. Both need lineage fields when `runs` gains parent/child columns.
- Web run detail currently renders source, agent, board/task, status, model/usage, connector actions, timeline, output/error, and raw trace in `packages/web/src/routes.ts`; parent/child links can be added minimally to the Details table.
- Current local workspace has agents `job-list-checker`, `jobfinder-research`, and `real-estate-intent`, plus automations `jobfinder-eu-ai-pm` and `real-estate-weekly-intent`. No suitable orchestration demo agents/automation exist yet.
- `.gitignore` confirms active `workspace/agents/*` and `workspace/automations/*.md` are local/gitignored except README stubs, so validation fixtures can be created there without committed artifacts.
- Intent/tool enumerations to update include runner connector types/mappings, provider resolution, connector override schemas and preservation, Pi extension registration, trace extraction/provider mapping, tests/smokes, and connector/workspace/docs tables.

## Relevant Files

- `docs/ARCHITECTURE.md` - Product/runtime architecture and connector boundary to update.
- `tasks/spec.md` - Target spec primitive list and runtime flow to update.
- `packages/runner/src/execute.ts` - Main reusable invocation execution path; needs programmatic/silent child-safe mode.
- `packages/runner/src/pi.ts` - Pi subprocess spawning and stdout/stderr handling; must remain safe for parent JSON stream.
- `packages/runner/src/invocation.ts` - Add subagent invocation source and child prompt framing.
- `packages/runner/src/db.ts` - Add run lineage fields and migration-safe columns.
- `packages/runner/src/connectors/types.ts` - Add `agent.invoke` intent and `agent_invoke` tool name/config types.
- `packages/runner/src/connectors/resolve.ts` - Resolve parent allowlist and runtime config for `agent.invoke`.
- `packages/runner/src/connectors/pi-extension.ts` - Register the new tool when gated.
- `packages/runner/src/connectors/` - Add agent invoke connector implementation and tests.
- `packages/runner/src/connectors/index.ts` - Barrel export new connector implementation.
- `packages/runner/src/connectors/trace.ts` - Add `agent_invoke` trace extraction/provider mapping.
- `packages/runner/src/automation.ts` - Add `agents.invoke` config schema to shared runner frontmatter parsing.
- `packages/core/src/services/automations.ts` - Preserve `agents` connector config through API/core automation writes.
- `packages/core/src/dto.ts` - Expose `agents` automation config and run lineage fields through DTOs.
- `packages/web/src/readers.ts` - Read run lineage fields for server-rendered HTML.
- `packages/web/src/routes.ts` - Surface parent/child run lineage on run detail if needed.
- `packages/web/src/api.ts` - API run endpoints use core run DTOs; verify lineage is returned.
- `packages/core/src/services/runs.ts` - Preserve/expose run lineage fields in run DTOs if needed.
- `workspace/agents/*/AGENT.md` - Local validation agents may be created here if absent.
- `workspace/automations/*.md` - Local validation automation may be created here if absent.
- `tasks/CHANGELOG.md` - Record completed feature and validation once done.

## Tasks

- [x] 1.0 Confirm current runtime seams and validation fixtures
  - [x] 1.1 Inspect current connector registration, connector trace extraction, and run DTO/web run detail paths.
  - [x] 1.2 Verify whether suitable local validation agents/automation already exist under `workspace/`; create only missing local/gitignored fixtures during validation.
  - [x] 1.3 Identify all places that enumerate connector intents/tool names so `agent.invoke` is added consistently.

- [x] 2.0 Add run lineage and subagent invocation modeling
  - [x] 2.1 Extend `InvocationSource` with a `subagent` source containing parent run id, root run id, child invocation id, and depth.
  - [x] 2.2 Add optional invocation lineage fields: `parentRunId`, `rootRunId`, and `depth`.
  - [x] 2.3 Add migration-safe `runs` columns for `parent_run_id`, `root_run_id`, and `depth`; add useful indexes.
  - [x] 2.4 Include lineage metadata in `jumpygoathq_run_meta`, `jumpygoathq_summary`, and runner JSONL logs.
  - [x] 2.5 Ensure existing automation and task runs continue to write valid rows with null lineage and depth `0` or null by design.

- [x] 3.0 Refactor execution for child-safe synchronous use
  - [x] 3.1 Add a programmatic/silent execution option to `executeInvocation` so child runs can be executed without contaminating the parent Pi JSON stdout stream.
  - [x] 3.2 Ensure child Pi stdout/stderr are captured into the child run log/DB row only, not inherited by the parent process stdout.
  - [x] 3.3 Add timeout support for programmatic child invocation or ensure the connector-level tool can terminate/return cleanly on timeout.
  - [x] 3.4 Set SQLite `busy_timeout` or equivalent safety if needed for parent and child runs writing concurrently.
  - [x] 3.5 Preserve existing CLI behavior for normal `pnpm runner <automation>` output.

- [x] 4.0 Implement gated `agent.invoke` connector/tool
  - [x] 4.1 Add `agent.invoke` to connector intents and map it to Pi tool name `agent_invoke`.
  - [x] 4.2 Add agent frontmatter config support, e.g. `agents.invoke.enabled`, `connector: jumpygoathq`, `allow`, `timeoutMs`, `maxDepth`, and `maxOutputChars`.
  - [x] 4.3 Resolve the tool only when parent `allowedIntents` includes `agent.invoke` and config has `enabled: true` plus a non-empty target allowlist.
  - [x] 4.4 Implement `agent_invoke` parameters: target `agent`, child `prompt`, optional `model`, and optional per-call output cap within configured bounds.
  - [x] 4.5 Validate target agent names, allowlist membership, max depth, non-empty prompt, and self-recursion policy.
  - [x] 4.6 Build child prompt with a small runtime prefix containing parent run id, target agent, and delegated subtask, then append the supplied prompt.
  - [x] 4.7 Execute child invocation synchronously through the normal runner path with separate workdir and normal child run row.
  - [x] 4.8 Return structured bounded text to the parent: child run id, status, duration, output tail/summary, and error tail on failure.
  - [x] 4.9 Emit connector action summaries/logs for start, success, failure, timeout, target denied, and depth denied.

- [x] 5.0 Add tests and observability coverage
  - [x] 5.1 Add connector resolution tests for disabled config, missing allowlist, missing parent intent, allowed target, and denied target.
  - [x] 5.2 Add unit/integration test coverage for child invocation construction and lineage metadata.
  - [x] 5.3 Add a mocked/safe test proving `agent_invoke` returns bounded child output and records connector summary details.
  - [x] 5.4 Update readable run trace handling if new `agent.invoke` connector events need display labels.
  - [x] 5.5 Update run detail/read APIs or web rendering to show parent/child run links if run DTOs already support the necessary fields; keep this minimal.

- [x] 6.0 Update docs and examples minimally
  - [x] 6.1 Update `docs/ARCHITECTURE.md` connector/tool section with `agent.invoke` and the synchronous child invocation flow.
  - [x] 6.2 Update `tasks/spec.md` with the first-scope `agent.invoke` primitive and constraints.
  - [x] 6.3 Add or update connector docs with frontmatter example, permission model, lineage behavior, output bounds, and failure semantics.
  - [x] 6.4 Document that child agents resolve their own permissions/model defaults and do not inherit parent connector capabilities.

- [ ] 7.0 Validate with real local orchestration automation
  - [x] 7.1 Create local/gitignored validation agents if absent:
    - `workspace/agents/local-file-reviewer/AGENT.md` - reviews selected local files or repo docs and returns concise findings.
    - `workspace/agents/git-diff-reviewer/AGENT.md` - runs/requests repo git diff and recent git log summary through allowed local capability.
    - `workspace/agents/repo-strategy-orchestrator/AGENT.md` - invokes both child agents and interprets the repo's strategic direction/refactor signals.
  - [x] 7.2 Create local/gitignored automation if absent: `workspace/automations/repo-strategy-orchestration.md` using `repo-strategy-orchestrator`.
  - [x] 7.3 Run `pnpm runner repo-strategy-orchestration` and inspect output for evidence that both child agents were invoked and parent interpreted their responses.
  - [x] 7.4 Inspect SQLite/web run detail for one parent run and two child runs with correct lineage, statuses, connector summaries, and bounded child output.
  - [x] 7.5 Run `pnpm --filter @jumpygoat-hq/runner test:connectors` or equivalent targeted runner tests.
  - [x] 7.6 Run `pnpm validate:backend` after runner changes.
  - [x] 7.7 Run `pnpm validate:web` if run detail/API/web DTOs changed.
  - [x] 7.8 Leave local validation fixtures in workspace only if they are useful user-owned product examples; otherwise remove only those created by this task.

- [x] 8.0 Closeout
  - [x] 8.1 Update `tasks/CHANGELOG.md` with implementation summary and exact validation commands/results.
  - [x] 8.2 Archive this task file to `tasks/done/YYYY-MM-DD_tasks-agent-invoke.md` after completion.
