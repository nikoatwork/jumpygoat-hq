# Generic Allowlisted Apify Connector

## Goal

Add a gated Apify connector so agents can run explicitly allowlisted Apify actors through Pi using one shared `APIFY_API_TOKEN` or local-compatible `APIFY_API_KEY`. Start with `apidojo/tweet-scraper` as the first documented/example actor, but keep the connector generic for future actors.

## Completion Summary

Implemented and validated the generic allowlisted Apify connector. The connector exposes `actor.run` / `apify_run_actor`, keeps actor permissions on agents, preserves automation input defaults, returns bounded dataset previews, supports `APIFY_API_TOKEN`/`APIFY_API_KEY`, includes mocked tests plus live smoke coverage, and is documented across runner, architecture, agent, and automation docs.

## Notes

- Use the existing connector architecture: provider-neutral intent, Pi-safe tool name, agent `allowedIntents`, connector config, bounded tool output, and connector audit summaries.
- Actor allowlists live only on the agent. Automations may choose an actor from that allowlist and provide data-only input defaults.
- Tool-call input may merge over automation input defaults. Reject executable/function values; frontmatter remains YAML/JSON data.
- Return only a bounded dataset preview to Pi; do not write the full dataset to the run workdir in v1.
- Keep normal tests mocked/offline. Add optional live smoke validation gated by `APIFY_API_TOKEN` or `APIFY_API_KEY`.

## Decisions

- Intent/tool/provider: `actor.run` → `apify_run_actor` → `apify`.
- Agent owns permission: `actors.run.allow` is the source of truth for permitted actor IDs.
- Automation owns run parameters: `actors.run.actor` and `actors.run.input` can define scheduled/default input.
- Merge behavior: effective input is `automation input` overlaid by tool-call `input`.
- Output behavior: bounded dataset preview plus run/dataset metadata; no full local dataset artifact in v1.
- Validation: mocked connector tests by default; optional live smoke script when `APIFY_API_TOKEN` or `APIFY_API_KEY` is present.

## Relevant Files

- `packages/runner/src/automation.ts` - Frontmatter schema for agent/automation connector config.
- `packages/runner/src/agent.ts` - Agent metadata and allowed intent loading.
- `packages/runner/src/invocation.ts` - Ensures automation connector overrides are carried into runner invocations.
- `packages/runner/src/connectors/types.ts` - Add intent/tool/provider/runtime config/action fields.
- `packages/runner/src/connectors/resolve.ts` - Resolve `actor.run` gating and Apify runtime config.
- `packages/runner/src/connectors/pi-extension.ts` - Register the Apify tool factory when enabled.
- `packages/runner/src/connectors/trace.ts` - Persist compact Apify connector action summaries from Pi trace.
- `packages/runner/test/connectors.test.ts` - Add mocked gating/tool behavior tests.
- `packages/runner/scripts/connectors/apify-smoke.ts` - Optional live Apify smoke script.
- `packages/core/src/dto.ts` - Automation DTO includes actor connector config for API/core callers.
- `packages/core/src/services/automations.ts` - Automation CRUD preserves actor connector config.
- `packages/web/src/api.ts` - API automation input/status summaries include actor connector config.
- `package.json`, `packages/runner/package.json`, `pnpm-lock.yaml` - Apify dependency and smoke scripts.
- `.env.example` - Document `APIFY_API_TOKEN` and `APIFY_API_KEY` alias.
- `docs/ARCHITECTURE.md` - Document the new connector intent and config pattern.
- `packages/runner/src/connectors/DOCS.md` - Document Apify provider behavior, secrets, and adding actors.
- `workspace/agents/README.md` - Show agent-level actor allowlist config.
- `workspace/automations/README.md` - Show automation-level actor choice/input defaults.

## Tasks

- [x] 1.0 Define Apify connector contract
  - [x] 1.1 Add `actor.run` to connector intents and `apify_run_actor` to connector tool names.
  - [x] 1.2 Add `apify` as a connector provider and runtime config type.
  - [x] 1.3 Add connector action fields for `actorId`, Apify run ID, dataset ID, item count, and dataset URL/console URL where useful.
  - [x] 1.4 Keep actor IDs and input payloads non-secret; keep `APIFY_API_TOKEN`/`APIFY_API_KEY` in env only.

- [x] 2.0 Add frontmatter schema and resolution
  - [x] 2.1 Extend connector override schema with `actors.run` config: `enabled`, `connector: apify`, `allow`, `actor`, `input`, `maxOutputItems`, `maxOutputChars`, and `timeoutMs`.
  - [x] 2.2 Enforce that actor allowlists are read from agent config only.
  - [x] 2.3 Allow automation config to select `actor` and provide data-only `input` defaults.
  - [x] 2.4 Resolve runtime config by merging agent defaults and automation run config without letting automations expand permissions.
  - [x] 2.5 Ensure invocation creation preserves `actors` overrides from automations.

- [x] 3.0 Implement Apify provider and Pi tool
  - [x] 3.1 Add `packages/runner/src/connectors/apify/` with `index.ts`, client/helper code, and tool factory.
  - [x] 3.2 Use `apify-client` or a small fetch client; add dependency only if it meaningfully reduces code and is compatible with ESM/build constraints.
  - [x] 3.3 Require `APIFY_API_TOKEN`/`APIFY_API_KEY` and return clear tool errors when missing.
  - [x] 3.4 Validate requested actor against the agent allowlist.
  - [x] 3.5 Build effective actor input by merging automation defaults with tool-call input.
  - [x] 3.6 Reject or safely ignore executable/function-shaped input values; support JSON/YAML data only.
  - [x] 3.7 Run the actor, fetch the default dataset items, and return bounded preview output.
  - [x] 3.8 Include compact `connectorSummary` details for audit storage.
  - [x] 3.9 Register the tool in `pi-extension.ts` behind the resolved plan allowlist.

- [x] 4.0 Add tests and optional live smoke
  - [x] 4.1 Add mocked connector-plan gating tests for `actor.run`.
  - [x] 4.2 Add mocked successful `apify_run_actor` test with dataset preview bounding.
  - [x] 4.3 Add tests for missing `APIFY_API_TOKEN`/`APIFY_API_KEY`, actor not allowlisted, and malformed/oversized input/output cases.
  - [x] 4.4 Add trace extraction test for Apify connector summaries.
  - [x] 4.5 Add `smoke:apify` script that runs only with Apify credentials and uses a low-cost/small input.
  - [x] 4.6 Add package/root script entries for the Apify smoke command.

- [x] 5.0 Document usage
  - [x] 5.1 Update connector docs with intent/tool/provider mapping and secret env var.
  - [x] 5.2 Update architecture docs with the generic allowlisted Apify actor pattern.
  - [x] 5.3 Update agent README with an `actors.run.allow` example using `apidojo/tweet-scraper`.
  - [x] 5.4 Update automation README with an example `actors.run.actor` and `actors.run.input` payload.
  - [x] 5.5 Update `.env.example` with `APIFY_API_TOKEN`/`APIFY_API_KEY`.
  - [x] 5.6 Add notes that actor-specific input schemas vary and should be documented per agent/automation.

- [x] 6.0 Validate and log completion
  - [x] 6.1 Run `pnpm --filter @jumpygoat-hq/runner test:connectors`.
  - [x] 6.2 Run `pnpm --filter @jumpygoat-hq/runner build` or repo `pnpm build` if broader types changed.
  - [x] 6.3 Optionally run `pnpm --filter @jumpygoat-hq/runner smoke:apify` with Apify credentials.
  - [x] 6.4 Run `pnpm validate:backend` if runtime behavior changed enough to need an end-to-end check.
  - [x] 6.5 Update `tasks/CHANGELOG.md` with implementation summary, validation, and any tradeoffs.
  - [x] 6.6 Archive this task to `tasks/done/<date>_tasks-apify-connector.md` when complete.

## Changelog

- 2026-06-14: Planned generic allowlisted Apify connector scope and architecture decisions from user discussion.
- 2026-06-14: Implemented connector contract, frontmatter resolution, Apify Pi tool, tests, docs, and live smoke script; `test:connectors`, `pnpm build`, one-item live `apidojo/tweet-scraper` smoke, `validate:backend`, and `validate:web` passed.
