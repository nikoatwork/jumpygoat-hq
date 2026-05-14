# Semantic Model Profiles and Instance Settings

## Completion Summary

Completed on 2026-05-14. Added instance-local semantic model profiles in `agenthqHome()/settings.yml`, runner model resolution/audit metadata, best-effort Pi usage logging, `/settings` editing and usage summary UI, docs, and coverage. Backend smoke passed with Codex subscription after using provider-prefixed selectors (`fast` → `openai-codex/gpt-5.4-mini`).

## Goal

Add instance-level semantic model profiles so agents, automations, and future tasks can use names like `super-smart`, `fast`, or `tiny` while AgentHQ resolves them to concrete Pi model selectors at runtime. Introduce a minimal Settings concept/UI for editing instance configuration without committing user-specific provider choices into the core app or public repo.

## Notes

- Model profile values are operator/instance state, not core product defaults. Store them under `agenthqHome()` / `$AGENTHQ_HOME`, not in committed source files.
- Pi remains responsible for provider auth, API keys, custom providers, and real model availability. AgentHQ only resolves semantic names to Pi `--model` selectors.
- Agent/automation `model` fields should accept either a semantic profile key or a concrete Pi selector. Unknown names should have a clear policy, likely pass-through with validation/warning rather than hard failure.
- Effective model order should remain: automation/task override > agent default > instance default profile > Pi default.
- Settings should be minimal/raw HTML like the rest of the web app.
- Pi JSON traces already include best-effort `message.usage` details for some providers/models (`input`, `output`, `cacheRead`, `cacheWrite`, `totalTokens`, and sometimes `cost`). If Pi/provider exposes reasoning tokens, AgentHQ should preserve them too, but not require them. AgentHQ can normalize those events instead of estimating tokens itself.
- Usage logging belongs in core run history, not instance settings: settings choose model policy; the run DB audits what actually happened.
- Treat usage/cost as best-effort observability. Do not add a custom tokenizer or committed pricing catalog; if Pi/provider does not emit usage/cost, store null/unknown and keep the run successful.
- This depends on or should follow `tasks/todo/tasks-agent-entity.md` so model defaults live on agents, not legacy skills.

## Relevant Files

- `tasks/todo/tasks-agent-entity.md` - Agent model default/override context this feature builds on.
- `packages/shared/paths.js` - Added helpers for instance settings paths.
- `packages/shared/paths.d.ts` - Type declarations for new settings path helpers.
- `packages/shared/settings.js` - Instance settings parser/formatter and semantic model resolver.
- `packages/shared/settings.d.ts` - Types for settings and model resolution helpers.
- `packages/runner/src/index.ts` - Resolve requested semantic model before invoking Pi.
- `packages/runner/src/pi.ts` - Ensure Pi receives only the resolved concrete model selector.
- `packages/runner/src/db.ts` - Store/audit requested vs resolved model and normalized run usage if schema changes are needed.
- `packages/runner/src/run-log.js` - Existing trace collector; usage extraction reads the same Pi JSON events.
- `packages/runner/src/usage.ts` - Normalizes/de-duplicates Pi-emitted usage events.
- `packages/web/src/readers.ts` - Read instance settings/model profiles and usage summaries for display/forms.
- `packages/web/src/actions.ts` - Validate and persist settings edits safely under `agenthqHome()`.
- `packages/web/src/routes.ts` - Add `/settings` routes.
- `packages/web/src/html.ts` - Add Settings navigation.
- `packages/web/src/trace-log.ts` - Already formats Pi usage events in run detail; keep in sync with normalized usage extraction.
- `tests/web/settings.spec.ts` - Smoke coverage for `/settings` and usage summary rendering.
- `packages/runner/test/model-settings.test.ts` - Unit coverage for settings/model resolution/usage extraction.
- `.gitignore` - Ignores local `workspace/settings.yml` instance settings.
- `workspace/` - Local default instance home where settings should live.
- `README.md` - Document semantic profiles, settings, and Pi/provider boundary.
- `docs/ARCHITECTURE.md` - Document instance settings and model resolution flow.
- `docs/DEPLOY.md` - Document `$AGENTHQ_HOME` settings file location and deployment behavior.
- `packages/web/DOCS.md` - Document Settings UI route and safety constraints.
- `tasks/CHANGELOG.md` - Update when complete.

## Architecture evaluation: model usage logging

This is worth doing in core if it stays narrow: AgentHQ runs Pi on behalf of scheduled/manual automations, already owns the run DB, and already captures Pi JSON traces. A user-facing "usage by model" view is operational run history, similar to status/duration/output, not provider configuration.

Recommended first version:

- Normalize usage from Pi JSON events at the runner boundary after the run finishes.
- Use Pi-emitted usage as source of truth; never estimate tokens locally.
- De-duplicate repeated partial/final events by stable response id when present, preferring the latest usage payload for each response.
- Store both semantic model resolution metadata and actual usage model metadata so reports can group by profile, resolved selector, or provider/model emitted by Pi.
- Add aggregate nullable columns on `runs` first (`usage_input_tokens`, `usage_output_tokens`, `usage_reasoning_tokens`, `usage_cache_read_tokens`, `usage_cache_write_tokens`, `usage_total_tokens`, `usage_cost_total`, `usage_currency`, `usage_provider`, `usage_model`, `usage_json`). This is enough for "usage by model" without introducing a second table yet.
- Defer a `run_usage_events` child table until there is evidence that a single AgentHQ run regularly uses multiple models/providers or needs per-turn billing audit.
- Show usage in the existing Runs UI and a small summary table by model/profile. Avoid making Settings own usage; Settings can link to Usage because model profiles explain the labels.

Open edge cases:

- Pi/provider may emit no usage, zero usage, or no reasoning-token breakdown for some models; report as unknown/0 exactly as emitted.
- Cost may be missing, provider-specific, or not comparable across providers; label it "reported cost" and keep token totals primary.
- If requested semantic profile resolves to one selector but Pi reports another model string, preserve both rather than trying to reconcile them.

## Tasks

- [x] 1.0 Define the instance settings contract
  - [x] 1.1 Decide canonical file location, e.g. `agenthqHome()/settings.yml` or `agenthqHome()/settings/model-profiles.yml`.
  - [x] 1.2 Define schema for `defaultModelProfile` and `modelProfiles` mapping profile keys to concrete Pi selectors.
  - [x] 1.3 Decide pass-through behavior for concrete selectors that do not match a profile key.
  - [x] 1.4 Define validation rules for profile keys, display labels, and model selector length/characters.
  - [x] 1.5 Explicitly document that secrets/API keys remain in Pi config or env, never in settings.

- [x] 2.0 Add shared settings path and loader support
  - [x] 2.1 Add shared path helpers for settings file/dir under `agenthqHome()`.
  - [x] 2.2 Add a small settings reader/parser with defaults when no settings file exists.
  - [x] 2.3 Add model resolution helper: requested model/profile + settings => `{ requestedModel, resolvedModel, profileKey? }`.
  - [x] 2.4 Ensure settings parsing errors are surfaced clearly in CLI and web UI.

- [x] 3.0 Integrate semantic profiles into runner model resolution
  - [x] 3.1 Resolve effective requested model from automation override, agent default, and instance default.
  - [x] 3.2 Convert semantic profile keys to concrete Pi selectors before calling `pi --model`.
  - [x] 3.3 Preserve pass-through for direct Pi model selectors according to the policy from 1.3.
  - [x] 3.4 Include requested model, resolved model, and matched profile key in run trace metadata.
  - [x] 3.5 Update DB schema/write/read logic if needed so run history can audit both human semantic name and concrete model.

- [x] 3A.0 Add best-effort model usage logging
  - [x] 3A.1 Add a runner helper that extracts usage from captured Pi JSON trace events and de-duplicates repeated response updates by `responseId` when present.
  - [x] 3A.2 Normalize aggregate usage totals per run: input, output, reasoning if emitted, cache read/write, total tokens, reported cost/currency if present, provider, and Pi-reported model.
  - [x] 3A.3 Persist usage on the `runs` row with nullable columns plus raw normalized `usage_json` for audit/debugging.
  - [x] 3A.4 Keep usage extraction best-effort: missing/unknown usage must not fail the automation run.
  - [x] 3A.5 Add a minimal usage summary reader grouped by resolved model/profile and/or Pi-reported model.
  - [x] 3A.6 Show per-run usage in run detail and a simple aggregate usage view/table in the web app.
  - [~] 3A.7 Defer provider pricing catalogs and per-turn usage tables unless Pi traces demonstrate that aggregates are insufficient. - Skipped/deferred by design.

- [x] 4.0 Add minimal Settings UI
  - [x] 4.1 Add `/settings` page with current settings file path, default model profile, and configured profiles.
  - [x] 4.2 Add edit flow using either structured fields or a cautious raw YAML textarea.
  - [x] 4.3 Validate settings before write and show parse/schema errors without corrupting the previous file.
  - [x] 4.4 Add Settings navigation link.
  - [x] 4.5 Update automation/agent forms to show available model profile keys as hints or selectable options if simple.

- [x] 5.0 Update docs and examples without committing user-specific mappings
  - [x] 5.1 Add docs explaining semantic model profiles and the Pi/provider boundary.
  - [x] 5.2 Add a committed README/example that uses placeholder selectors only, not real user defaults.
  - [x] 5.3 Update architecture/runtime flow to show model profile resolution before Pi invocation.
  - [x] 5.4 Update deployment docs to include the instance settings file under `$AGENTHQ_HOME`.

- [x] 6.0 Validate
  - [x] 6.1 Add unit coverage for settings parsing, model resolution, and Pi usage extraction/de-duplication.
  - [x] 6.2 Add web validation/smoke coverage for `/settings` and usage summary rendering without invoking Pi.
  - [x] 6.3 Run `pnpm build`.
  - [x] 6.4 Run `pnpm validate:web` and inspect Playwright output.
  - [x] 6.5 Run `pnpm validate:backend` only if local Pi auth/provider availability is expected.

## Decisions

- Semantic model mappings are instance/operator configuration under `agenthqHome()` / `$AGENTHQ_HOME`, not committed core app state.
- Pi owns provider auth and concrete model availability; AgentHQ owns semantic policy and audit metadata.
- Usage logging is core runtime observability stored in the SQLite run DB, not a settings-file concern.
- Pi-emitted usage/cost is the only source of truth for token/cost reporting; AgentHQ should not estimate tokens or maintain pricing tables in this feature.

## Blockers

- **2026-05-14:** Initial live Pi/backend smoke used bare selectors (`gpt-5.4-mini`, `gpt-5.5`) and Pi resolved them through Azure, which lacked API key auth. Resolved by using provider-prefixed Codex selectors in instance settings: `openai-codex/gpt-5.4-mini` and `openai-codex/gpt-5.5`.

## Changelog

- 2026-05-14: Added semantic model profiles/settings UI, runner model resolution audit metadata, best-effort Pi usage logging, usage summary UI, docs, and tests. Backend smoke passed with Codex subscription using `fast` → `openai-codex/gpt-5.4-mini`.
