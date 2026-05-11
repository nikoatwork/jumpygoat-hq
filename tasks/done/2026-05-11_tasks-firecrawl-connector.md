---
STATUS: COMPLETED
COMPLETED_DATE: 2026-05-11
FEATURE: firecrawl-connector
---

# Context

Add runner-gated Pi tool connectors for external services. Firecrawl should expose web search and crawling/scraping tools that Pi can call during an automation run, so tool results and failures are available to the model while it reasons. The existing Resend notification connector should also migrate from post-run fenced `agenthq-action` handling to a Pi tool connector so Pi can see email delivery failures/results in-run. Connector exposure must require both gates: automation config enables the connector and the skill frontmatter `allowedIntents` includes the relevant provider-neutral intent. Use well-encapsulated connector folders with barrel exports only.

The earlier post-run connector path can remain temporarily for backwards compatibility during migration, but the target architecture is tool connectors as the default connector mode.

## TL;DR

**Completed:** 2026-05-11

**What we built:**
- Runner-gated Pi connector extension infrastructure with automation + skill intent gates.
- Firecrawl `web_search`, `web_scrape`, and `web_crawl` tools with bounded output and traceable errors.
- Resend `notify_email` in-run tool connector with legacy fenced-action compatibility during migration.

**What changed along the way:**
- Chose a static Pi extension loaded with run-scoped env/config JSON instead of generating an extension per run.
- Persisted compact success/failure connector summaries from Pi JSON trace events into `connector_actions_json`.

**Skipped/Deferred:**
- None.

## Brief

Implement a standardized connector architecture where the runner assembles a gated Pi extension for enabled/allowed external tools. Add Firecrawl tools for `web.search`, `web.scrape`, and `web.crawl`; migrate Resend to a `notify.email` Pi tool connector; capture connector execution summaries/errors in trace and `connector_actions_json` without relying on post-run actions for normal operation.

## Relevant Files

- `packages/runner/src/pi.ts` - Runner Pi invocation; should pass the generated/packaged connector extension when gated tools are enabled.
- `packages/runner/src/index.ts` - Runner flow and run metadata; may pass run id/context into connector extension env and persist connector action summaries.
- `packages/runner/src/connectors/` - New standardized connector folder with barrel exports only.
- `packages/runner/src/connectors/index.ts` - Public connector module export surface.
- `packages/runner/src/connectors/types.ts` - Shared connector config, intent, execution summary, and tool-registration types.
- `packages/runner/src/connectors/helpers.ts` - Shared URL validation, truncation, fetch timeout, response parsing, and summary helpers.
- `packages/runner/src/connectors/resolve.ts` - Automation + skill intent gating and run-scoped connector plan serialization.
- `packages/runner/src/connectors/trace.ts` - Pi JSON trace extraction for connector action records.
- `packages/runner/src/connectors/legacy.ts` - Temporary post-run Resend fenced-action compatibility path.
- `packages/runner/src/connectors/firecrawl/` - Firecrawl connector implementation, exported through its local barrel.
- `packages/runner/src/connectors/resend/` - Resend connector implementation, exported through its local barrel.
- `packages/runner/src/connectors/pi-extension.ts` - Static Pi extension entrypoint that registers gated connector tools.
- `packages/runner/src/automation.ts` - Automation frontmatter schema/config parsing for connector enablement.
- `packages/runner/src/skill.ts` - Skill metadata and `allowedIntents` parsing.
- `packages/runner/src/run-log.ts` - Trace/output capture helpers; unchanged because connector summaries are extracted from trace text.
- `packages/runner/src/db.ts` - Run row persistence including `connector_actions_json`; unchanged schema already supported connector summaries.
- `packages/runner/src/connectors.ts` - Removed old monolithic post-run connector module in favor of connector folder modules.
- `packages/runner/test/connectors.test.ts` - Mocked fetch coverage for gating, Firecrawl tools, Resend tool, and trace extraction.
- `.env.example` - Document `FIRECRAWL_API_KEY` and Resend secrets.
- `docs/ARCHITECTURE.md` - Document connector architecture/config.
- `automations/README.md` - Document automation connector config.
- `skills/README.md` - Document skill `allowedIntents` and connector tool usage.
- `packages/runner/src/connectors/DOCS.md` - Co-located docs describing the connector contract and how to add connectors.
- `packages/runner/package.json` - Added connector test script.
- `automations/daily-review.md` - Updated notification instruction to prefer the in-run email tool.
- `skills/daily-review/SKILL.md` - Updated skill notification guidance to call `notify_email` instead of emitting legacy fenced actions.
- `tasks/CHANGELOG.md` - Added a dated task-level changelog entry.

### Notes

- **Architecture decision:** Connector tools are the default architecture because Pi must be able to observe connector results/failures during the run.
- **Gating decision:** Both gates are required: automation connector config enabled + skill `allowedIntents` includes the relevant intent.
- **Intent naming decision:** Use provider-neutral intents: `web.search`, `web.scrape`, `web.crawl`, and `notify.email`.
- **Tool naming decision:** Use Pi-safe tool names: `web_search`, `web_scrape`, `web_crawl`, and `notify_email`.
- **Resend migration decision:** Include migration to a Pi tool connector in this task. Keep post-run fenced action support only if needed for compatibility.
- **Encapsulation decision:** Use folder-local `index.ts` barrel exports; imports from outside a folder should target the folder barrel only.
- Keep Firecrawl result payloads bounded in tool output so Pi can use them without bloating context.
- Capture connector errors/summaries in trace and `connector_actions_json` where feasible.
- Avoid introducing a custom LLM/tool loop; use Pi extensions/custom tools.
- Run `pnpm build` after TypeScript changes.
- Run `pnpm validate:backend` if local Pi auth/provider availability is expected.

## Validation

- `pnpm --filter @agenthq/runner test:connectors` — passed.
- `pnpm build` — passed.
- `pnpm validate:backend` — passed; daily-review smoke completed with `connector_actions_json: []` because no notification was warranted.
- `pnpm validate:web` — passed.

## Tasks

- [x] 1.0 Define the connector architecture and schemas
  - [x] 1.1 **Clarify:** Should connectors be post-run actions or Pi tools? - Answer: Pi tools are the target architecture; Resend should migrate too.
  - [x] 1.2 Define the connector folder/module boundaries and barrel-export rules.
  - [x] 1.3 Define automation frontmatter config for Firecrawl and Resend tool enablement.
  - [x] 1.4 Define skill `allowedIntents` mapping to tool names.
  - [x] 1.5 Define connector execution summary records for trace and `connector_actions_json`.
  - [x] 1.6 Define compatibility behavior for existing Resend fenced `agenthq-action` blocks.

- [x] 2.0 Build the connector extension infrastructure
  - [x] 2.1 **Clarify:** Should the connector extension be a static project extension file loaded with run-specific env/config, or generated per run? - Answer: static extension loaded with run-specific env/config JSON.
  - [x] 2.2 Create `packages/runner/src/connectors/` with shared types/helpers and barrel exports.
  - [x] 2.3 Add logic to resolve enabled connector tools from automation config + skill `allowedIntents`.
  - [x] 2.4 Add a Pi extension entrypoint that registers only resolved connector tools.
  - [x] 2.5 Update `runPiAutomation` to pass `--extension` only when connector tools are enabled.
  - [x] 2.6 Pass run context/config to the extension without exposing secrets in automation files.

- [x] 3.0 Implement Firecrawl web tool connector
  - [x] 3.1 **Clarify:** Should `web_crawl` use Firecrawl async crawl jobs, or start with bounded synchronous scrape/map behavior if async polling is too much for MVP? - Answer: bounded Firecrawl async crawl with polling, strict page/depth/time limits.
  - [x] 3.2 Implement `web_search` with query, optional limit, timeout/error handling, and bounded result text.
  - [x] 3.3 Implement `web_scrape` with URL validation, optional formats/options, timeout/error handling, and bounded result text.
  - [x] 3.4 Implement `web_crawl` with safe page/depth limits and bounded output.
  - [x] 3.5 Ensure missing `FIRECRAWL_API_KEY` returns a tool error Pi can read and a traceable connector summary.
  - [x] 3.6 Ensure Firecrawl tool responses are useful to Pi but constrained enough for automation context.

- [x] 4.0 Migrate Resend notification to a Pi tool connector
  - [x] 4.1 **Clarify:** Should `notify_email` send immediately when called, or require an explicit confirmation parameter in the tool args? - Answer: send immediately when called; automation+skill gates and skill instructions are the confirmation layer.
  - [x] 4.2 Move Resend send logic behind a connector module with barrel exports.
  - [x] 4.3 Implement `notify_email` with subject/body/to/from args/defaults and provider message id in the result.
  - [x] 4.4 Enforce missing `RESEND_API_KEY`, recipient, and sender as tool errors Pi can read.
  - [x] 4.5 Add run/tool-call metadata to reduce duplicate-send ambiguity where possible.
  - [x] 4.6 Keep or adapt legacy post-run `agenthq-action` notification processing during transition if it does not complicate the architecture.

- [x] 5.0 Persist connector execution summaries and preserve run behavior
  - [x] 5.1 **Clarify:** Is `connector_actions_json` required to include successful tool calls, or only errors/failures? - Answer: include successes, failures, and migration skips as compact records.
  - [x] 5.2 Capture connector tool start/end/error events from Pi JSON trace if available.
  - [x] 5.3 Persist connector summaries/errors to `connector_actions_json` without duplicating large Firecrawl payloads.
  - [x] 5.4 Preserve behavior when no connector tools are enabled.
  - [x] 5.5 Preserve behavior when Pi run fails after one or more connector tools executed.

- [x] 6.0 Add tests or validation coverage for connector gating and tools
  - [x] 6.1 **Clarify:** Should connector unit tests be added now with mocked `fetch`, or is build plus backend smoke validation enough for this phase? - Answer: add mocked `fetch` connector tests plus build/backend smoke validation.
  - [x] 6.2 Add tests or script checks for automation config + skill intent gating.
  - [x] 6.3 Add mocked `fetch` coverage for Firecrawl search/scrape/crawl success and error responses if the repo test setup supports it.
  - [x] 6.4 Add mocked `fetch` coverage for Resend tool success and missing config/error responses if feasible.
  - [x] 6.5 Run `pnpm build` and fix TypeScript errors.
  - [x] 6.6 Run `pnpm validate:backend` when local Pi auth/provider availability is expected, and inspect the output/error/trace tails.

- [x] 7.0 Update documentation, including co-located connector docs for future connectors
  - [x] 7.1 **Clarify:** Should connector docs target only maintainers, or also skill authors writing automation/skill prompts? - Answer: both; connector DOCS for maintainers, automation/skills docs for authors.
  - [x] 7.2 Create `packages/runner/src/connectors/DOCS.md` documenting connector folder structure, barrel exports, gating, Pi extension tools, config, result records, error conventions, and how to add a connector.
  - [x] 7.3 Update `.env.example` with `FIRECRAWL_API_KEY` and confirm Resend secret docs remain accurate.
  - [x] 7.4 Update `docs/ARCHITECTURE.md` to describe tool connectors as the default architecture and legacy post-run actions if retained.
  - [x] 7.5 Update `automations/README.md` with Firecrawl and Resend connector config examples.
  - [x] 7.6 Update `skills/README.md` with allowed intent examples and tool usage guidance for skills.
