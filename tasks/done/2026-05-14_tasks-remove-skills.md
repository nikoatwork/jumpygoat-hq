# Remove Skills as an jumpyGoatHq Concept

## Completion summary

Completed 2026-05-14. jumpyGoatHq-facing runtime/web/docs no longer expose skills as a product concept. The only current non-archived references are Pi adapter details for `--skill`/`--no-skills` in `packages/runner/src/pi.ts` and `docs/ARCHITECTURE.md`. Legacy file pointers were deleted, gitignore runtime contracts were removed, the run DB schema no longer declares or writes the legacy column, web fallbacks were removed, and setup now drops the old column from existing local DBs.

## Goal

Remove remaining jumpyGoatHq-facing `skill` concepts now that the product primitive is `agent`. Keep only the unavoidable Pi CLI adapter detail where jumpyGoatHq invokes `pi --skill <generated-agent-file>`, and document that as an implementation detail rather than a domain concept.

## Notes

- Pre-release breaking changes are allowed; do not keep compatibility shims just to support old `skill:` automations or old run rows.
- Agents connect to external services through jumpyGoatHq connectors: `allowedIntents` + connector config + runner-resolved Pi extension tools.
- Avoid introducing a new abstraction to replace skills. The clean primitive set is agent, automation, project/task, connector/tool, workspace, run, instance settings.

## Findings

- **2026-05-14:** Final boundary: current product docs/code may mention Pi `--skill`/`--no-skills` only as Pi CLI adapter terminology. Current jumpyGoatHq concepts are agent, automation, project/task, connector/tool, workspace, run, and instance settings.
- **2026-05-14:** Old automation frontmatter with a top-level legacy field is unsupported. Runner frontmatter parsing is strict, so unknown top-level keys fail instead of being migrated or silently accepted.
- **2026-05-14:** Old SQLite run rows/columns do not need preservation. New schema omits the legacy column; setup drops it from existing local DBs so inserts do not fail against old `not null` constraints.
- **2026-05-14:** `rg -ni "skill|skills" packages scripts tests docs workspace README.md .gitignore -g '*.ts' -g '*.md'` now returns only Pi adapter references in `packages/runner/src/pi.ts` and `docs/ARCHITECTURE.md`. Broader task-tree hits are historical archived task/changelog/research text plus this completed task file.

## Validation

- [x] `pnpm --filter @jumpygoat-hq/runner build && pnpm --filter @jumpygoat-hq/web build` — passed.
- [x] `pnpm validate:web` — passed, 16 tests.
- [x] `pnpm validate:backend` — first exposed an existing DB `not null` issue for the old column; after adding setup cleanup, passed with run `01KRK9EXSZAGX73C3T1QZH50RB`.

## Relevant Files

- `docs/ARCHITECTURE.md` - Canonical architecture language and runtime flow.
- `docs/vision/strategy/agent.md` - Strategy says agents are the product primitive.
- `tasks/vision.md` - Short product vision now uses agent-bundle language.
- `.gitignore` - Removed legacy active runtime directory contracts.
- `README.md` - Removed legacy data model entries and updated run table.
- `packages/runner/src/pi.ts` - Only valid remaining `--skill` usage; documented as Pi CLI adapter detail.
- `packages/runner/src/db.ts` - Removed legacy run column/backfill and drops old column during setup.
- `packages/runner/src/automation.ts` - Strict top-level frontmatter parsing rejects legacy top-level keys.
- `packages/web/src/readers.ts` - Removed legacy run display fallback.
- `packages/web/src/trace-log.ts` - Removed legacy trace fallback.
- `packages/runner/src/connectors/DOCS.md` - Connector docs say agents get tools through `allowedIntents` plus connector config.
- `docs/examples/web-research-email-agent.md` - Example agent for web/email connector gates.
- `tasks/CHANGELOG.md` - Updated with cleanup summary.
- `skills/README.md` - Deleted.
- `workspace/skills/README.md` - Deleted.

## Tasks

- [x] 1.0 Define the final no-skills boundary
  - [x] 1.1 Confirm the only acceptable remaining string is Pi CLI `--skill` in the adapter layer and docs explaining that adapter detail.
  - [x] 1.2 Confirm old automation frontmatter `skill:` is unsupported and should fail clearly rather than migrate.
  - [x] 1.3 Confirm old SQLite run rows/columns do not need preservation.

- [x] 2.0 Remove legacy runtime compatibility
  - [x] 2.1 Remove `runs.skill` from DB schema/setup code and insert paths.
  - [x] 2.2 Remove any backfill that writes agent names into `skill`.
  - [x] 2.3 Remove web/backend fallbacks that display `run.skill` when `run.agent` is missing.
  - [x] 2.4 Ensure automation parsing rejects or ignores `skill:` with an agent-focused error message.
  - [x] 2.5 Keep `pi --skill <generated-agent-file>` isolated in `packages/runner/src/pi.ts` with a code comment explaining Pi terminology.

- [x] 3.0 Remove legacy file/directory contracts
  - [x] 3.1 Delete or replace top-level `skills/` pointer if it is no longer useful.
  - [x] 3.2 Delete `workspace/skills/README.md` and stop documenting `workspace/skills` as an active or legacy contract.
  - [x] 3.3 Update `.gitignore`, docs, examples, and package docs that mention active `skills/` runtime state.
  - [x] 3.4 Verify project setup scripts no longer create or expect `skills/` directories.

- [x] 4.0 Tighten connector language around agents
  - [x] 4.1 Update connector docs to state that agents get tools through `allowedIntents` plus connector config.
  - [x] 4.2 Add or refine an agent example for email/web access using `notify.email` and `web.search`.
  - [x] 4.3 Document the future connector pattern for Notion-like tools without adding a Notion implementation.
  - [x] 4.4 Ensure docs never imply skills grant tool access.

- [x] 5.0 Clean docs and UI terminology
  - [x] 5.1 Search code/docs for `skill`/`skills` and classify each hit as remove, historical archive, or Pi adapter detail.
  - [x] 5.2 Update current docs, README files, web labels, validation docs, and testing docs to use `agent`.
  - [x] 5.3 Leave historical completed task files unchanged unless they confuse current instructions.
  - [x] 5.4 Update `docs/ARCHITECTURE.md` so skills are not listed as a concept and legacy DB wording is removed after schema cleanup.

- [x] 6.0 Validate the no-skills cleanup
  - [x] 6.1 Run `rg -n "skill|skills"` and confirm only intentional historical/archive or Pi adapter references remain.
  - [x] 6.2 Run `pnpm validate:web` after web/docs-facing code changes.
  - [x] 6.3 Run `pnpm validate:backend` after runner/DB changes.
  - [~] 6.4 Run `pnpm validate` if the narrower validations pass and broad confidence is needed - Skipped: narrower validations passed; full validate would repeat the same web/backend checks and spend another backend smoke run.

- [x] 7.0 Finish and archive
  - [x] 7.1 Update `tasks/CHANGELOG.md` with the no-skills cleanup summary.
  - [x] 7.2 Move this task file to `tasks/done/YYYY-MM-DD_tasks-remove-skills.md` when complete.
