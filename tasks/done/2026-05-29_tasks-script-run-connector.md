# Script Run Connector

## Goal

Add a safe, gated `script.run` connector so an agent can execute allowlisted TypeScript scripts bundled inside its own agent folder. This enables small deterministic workflows, like the real-estate search agent, without turning agent folders into arbitrary ungoverned code execution.

## Notes

- V1 supports `tsx`/TypeScript only.
- Scripts must be bundled under `workspace/agents/<agent>/scripts/`.
- Persistent script state should live under the same agent folder, preferably `workspace/agents/<agent>/state/`.
- Network access is denied by default and must be explicitly enabled in connector config.
- Writes are denied by default and must be explicitly enabled/scoped to the agent folder.
- Active workspace agents are already gitignored/private by default; pulling repo updates should not overwrite user agent scripts/state.
- Treat `script.run` as a connector/tool with audit records, not as an agent-local bypass around connector policy.

## Decisions

- Agent-bundled scripts only; no automation/workspace arbitrary script paths.
- Explicit `network: true` required for scripts that call external APIs.
- Read-only default; persistent writes allowed only when configured and scoped to the agent folder.
- TSX only for v1; no Python runner in this task.

## Relevant Files

- `packages/runner/src/connectors/types.ts` - Add `script.run` intent and `script_run` tool name/provider types.
- `packages/runner/src/automation.ts` - Parse `scripts.run` frontmatter config from agents/automations.
- `packages/runner/src/connectors/resolve.ts` - Gate and resolve script runtime config from agent defaults + invocation overrides.
- `packages/runner/src/connectors/pi-extension.ts` - Register script connector tools when enabled.
- `packages/runner/src/connectors/trace.ts` - Attribute `script_run` audit records to the script connector.
- `packages/runner/src/connectors/script/` - New connector implementation.
- `packages/runner/test/connectors.test.ts` - Mock/test gating, path safety, timeout/output bounds, audit summaries.
- `packages/shared/paths.*` or `packages/runner/src/paths.ts` - Reuse/extend helpers for agent script/state paths if needed.
- `scripts/doctor.ts` - Optional, non-failing script connector diagnostics.
- `workspace/agents/README.md` - Document `scripts/`, `state/`, and connector policy for agent authors.
- `workspace/automations/README.md` - Document safe per-run script overrides.
- `docs/connectors/README.md` - Add script connector to connector catalog.
- `docs/connectors/script-run.md` - User setup guide for scripts.
- `packages/web/DOCS.md` - API setup examples for creating agents/automations with script connector config.
- `packages/cli/DOCS.md` / `packages/cli/QUICKSTART.md` - CLI/API notes for applying script-enabled agent bundles.
- `.env.example` - Add any optional script runner env defaults only if needed.
- `tasks/CHANGELOG.md` - Add dated completion summary when finished.

## Proposed config shape

```yaml
allowedIntents:
  - script.run

scripts:
  run:
    enabled: true
    connector: local-script
    allow:
      - scripts/search-immoscout.ts
    network: true
    write: true
    timeoutMs: 60000
    maxOutputChars: 12000
```

Tool call shape:

```json
{
  "script": "scripts/search-immoscout.ts",
  "input": { "search": "berlin-apartments" }
}
```

Expected script contract:

- Runs with `tsx`.
- Receives JSON input through stdin or a temp input file.
- Writes JSON/text result to stdout.
- May write persistent state only under the agent folder when `write: true`.
- Should keep durable state under `state/`, e.g. `state/listing-log.json`.

## Progress

- 2026-05-29: Implemented `script.run` as a gated local-script connector with runner/core/API support, safe path checks, bounded TSX execution, trace summaries, docs, and examples. Validation passed: `pnpm --filter @jumpygoat-hq/runner test:connectors`, `pnpm build`, `pnpm validate:web`, `pnpm validate:backend`. Archived to `tasks/done/2026-05-29_tasks-script-run-connector.md`.

## Tasks

- [x] 1.0 Define script connector safety contract
  - [x] 1.1 Confirm final frontmatter schema: `scripts.run.enabled`, `connector`, `allow`, `network`, `write`, `timeoutMs`, `maxOutputChars`.
  - [x] 1.2 Define script tool parameter schema: script path, optional JSON input, optional per-call output bound.
  - [x] 1.3 Define path rules: only relative paths under `scripts/`, no `..`, symlinks resolved inside agent folder, no absolute paths.
  - [x] 1.4 Define execution cwd/env: agent folder as cwd, minimal inherited env, run metadata env vars, no secret injection beyond normal process env.
  - [x] 1.5 Define audit summary fields: script path, exit code, duration, output chars, truncated flag, network/write flags.

- [x] 2.0 Add schema, intent, and connector plan support
  - [x] 2.1 Add `script.run` and `script_run` to connector types/mappings.
  - [x] 2.2 Add `local-script` provider type and runtime config type.
  - [x] 2.3 Extend agent/automation parsing to accept `scripts.run` config.
  - [x] 2.4 Update connector resolution/gating to require both `allowedIntents: [script.run]` and enabled config.
  - [x] 2.5 Pass agent folder path and resolved script settings to the connector extension without putting secrets in markdown.

- [x] 3.0 Implement the script connector
  - [x] 3.1 Create `packages/runner/src/connectors/script/index.ts` and `tools.ts`.
  - [x] 3.2 Implement path validation and allowlist matching.
  - [x] 3.3 Execute scripts with `tsx` and bounded timeout.
  - [x] 3.4 Pass tool input to the script deterministically, preferably via stdin JSON.
  - [x] 3.5 Capture stdout/stderr, truncate output, and return useful content to Pi.
  - [x] 3.6 Enforce read/write boundary in v1 as strongly as practical; if OS-level sandboxing is not feasible, document limitations and enforce path/config checks in the contract.
  - [x] 3.7 Return compact connector summaries for success, failure, timeout, missing script, disallowed path, and non-zero exit.

- [x] 4.0 Register and trace script tool execution
  - [x] 4.1 Register script tools from `pi-extension.ts` only when enabled.
  - [x] 4.2 Update trace connector attribution for `script_run`.
  - [x] 4.3 Ensure connector action records are persisted with no large stdout/stderr payloads.
  - [x] 4.4 Ensure no behavior change when no script tools are enabled.

- [x] 5.0 Add tests and validation coverage
  - [x] 5.1 Test connector gating: disabled config, missing allowed intent, valid enabled config.
  - [x] 5.2 Test safe path enforcement: absolute path, `..`, unallowlisted script, symlink escape if feasible.
  - [x] 5.3 Test successful TSX script execution with JSON input and bounded output.
  - [x] 5.4 Test timeout/non-zero exit/missing `tsx` failure behavior.
  - [x] 5.5 Test connector trace extraction/audit summaries.
  - [x] 5.6 Run `pnpm --filter @jumpygoat-hq/runner test:connectors`.
  - [x] 5.7 Run `pnpm build`.
  - [x] 5.8 Run `pnpm validate:web` after API/docs-visible changes.
  - [x] 5.9 Run `pnpm validate:backend` if local Pi auth/provider is available.

- [x] 6.0 Document setup for users, agents, API, and CLI
  - [x] 6.1 Add `docs/connectors/script-run.md` with safety model, config, script contract, examples, and limitations.
  - [x] 6.2 Update `docs/connectors/README.md` connector catalog.
  - [x] 6.3 Update `workspace/agents/README.md` to explain `scripts/` and `state/` as agent-bundled private runtime resources gated by `script.run`.
  - [x] 6.4 Update `workspace/automations/README.md` with per-run script override examples.
  - [x] 6.5 Update `packages/web/DOCS.md` API examples showing script-enabled agent/automation creation.
  - [x] 6.6 Update `packages/cli/DOCS.md` / `packages/cli/QUICKSTART.md` with how to apply script-enabled bundles through API/CLI.
  - [x] 6.7 Update `scripts/doctor.ts` with optional, non-failing script connector diagnostics, e.g. `tsx` availability.

- [x] 7.0 Prove the real-estate use case with a small example
  - [x] 7.1 Add a documentation-only example under `docs/examples/real-estate-script-agent.md`.
  - [x] 7.2 Sketch `scripts/search-immoscout.ts` expected inputs/outputs without committing personal search data or secrets.
  - [x] 7.3 Show persistent state convention under `state/listing-log.json`.
  - [x] 7.4 Show how the agent combines `script_run` output with `mail_send` for summaries.

- [x] 8.0 Close out
  - [x] 8.1 Update `tasks/CHANGELOG.md` with completed summary and validation results.
  - [x] 8.2 Move this task file to `tasks/done/YYYY-MM-DD_tasks-script-run-connector.md` when complete.
