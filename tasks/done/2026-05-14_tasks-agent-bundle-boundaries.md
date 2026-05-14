# Agent Bundle Boundaries and Skill-Like Richness

## Completion summary

Completed 2026-05-14. jumpyGoatHq bundle/tool/invocation/run boundaries are documented, only `AGENT.md` plus ordered `context/*.md` are loaded today, reserved agent resource directories are documented as non-loaded, Pi run framing now disables raw Pi resource/context discovery, generated agent instructions include an jumpyGoatHq runtime frame, and web/docs/examples match the split.

## Goal

Clarify and implement the jumpyGoatHq mental model inspired by Hermes/Pi skills without reintroducing `skill` as a top-level product primitive:

```text
Agent bundle = identity, instructions, context, memory, reusable procedures
Connector/tool = governed external capability with secrets, schemas, audit
Automation/task = invocation of an agent
Run = audit record
```

Agents should be allowed to grow beyond a single markdown file through explicit jumpyGoatHq contracts, while connectors remain the governed path for external side effects.

## Notes

- Hermes separates identity (`SOUL.md`), memory, skills/procedural knowledge, tools/toolsets, cron jobs, and runs. The useful lesson is the split, not copying every concept.
- For jumpyGoatHq, keep primitives small: agent, connector/tool, automation/task, run.
- Treat skill-like folders as an implementation/design influence: progressive disclosure, reusable procedures, references, assets, helper scripts, memory.
- Do not make raw Pi skills the public control-plane primitive.
- Investigate whether jumpyGoatHq should pass a custom Pi system prompt for runs, or whether generated `AGENT.md` + context injection via `--skill` is enough.

## Findings

- **2026-05-14:** Pi docs/CLI confirm `--system-prompt` replaces the default prompt but still appends context files and skills; `--append-system-prompt` appends to the system prompt; `--skill` is repeatable; `--no-skills` disables discovered skills while explicit CLI skill paths still load; `--no-context-files` disables parent/current `AGENTS.md` and `CLAUDE.md`; JSON mode emits JSONL events. Source inspection of Pi `resource-loader.js` confirmed explicit CLI skills remain in the path list when `--no-skills` is set.
- **2026-05-14:** Because jumpyGoatHq workspaces live under the repo by default, keeping Pi context discovery could silently load parent repo `AGENTS.md` into scheduled/task runs. Decision: disable raw Pi skill discovery and context-file discovery for jumpyGoatHq runs; only the generated jumpyGoatHq instruction file and explicit connector extension should frame the run.
- **2026-05-14:** No custom `--system-prompt`/`--append-system-prompt` is needed now. Generated `AGENT.md` injection is enough if the generated file includes a small jumpyGoatHq runtime frame for connector boundaries, workspace rules, and output expectations. This avoids duplicating large context across a system prompt plus generated skill file.
- **2026-05-14:** First-class agent bundle directories now are `AGENT.md` and `context/*.md` only. Reserved/non-loaded directories: `references/`, `templates/`, `assets/`, `procedures/`, `scripts/`, and `memory/`.
- **2026-05-14:** Future memory should be bounded, curated, frozen at run start, and updated only through an explicit domain service/tool. Default should be per-agent curated memory in the agent folder; project/user-wide memory should be represented by documented project files or a shared data store, not hidden workspace writes.
- **2026-05-14:** Agent-created procedures should be deferred until core primitives stabilize. `procedures/`/`references/` are reserved authoring space only for now. `scripts/` must not execute unless a future contract adds explicit gating, trace metadata, and audit behavior.
- **2026-05-14:** `rg -n "skill|skills|SOUL|memory|connector" docs tasks packages workspace -g '*.md' -g '*.ts'` showed remaining current `skill` language is mostly intentional strategy/Pi-adapter discussion, historical completed task/changelog text, and the separate `tasks-remove-skills.md` cleanup scope. Current stale-ish items outside this task include `tasks/todo/tasks-02-deploy.md` and legacy DB/web `skill` fallbacks already assigned to `tasks-remove-skills.md`.

## Validation

- [x] `pnpm --filter @jumpygoat-hq/runner build && pnpm --filter @jumpygoat-hq/web build` — passed.
- [x] `pnpm validate:web` — passed, 15 Playwright/tests.
- [x] `pnpm validate:backend` — passed; smoke run `01KRK8XC12F4JDS89BH8VRR2NS` invoked Pi with the generated agent bundle and wrote an inspectable run row.

## Relevant Files

- `docs/ARCHITECTURE.md` - Canonical architecture and concept boundaries.
- `docs/vision/strategy/agent.md` - Strategic north star and tradeoffs.
- `tasks/vision.md` - Short product vision.
- `workspace/agents/README.md` - User-facing agent folder contract.
- `workspace/automations/README.md` - Automation invocation and override contract.
- `packages/runner/src/agent.ts` - Agent loading and generated instruction content.
- `packages/runner/src/pi.ts` - Pi invocation, currently using `--skill <generated-agent-file>`.
- `packages/runner/src/connectors/DOCS.md` - Connector/tool contract.
- `packages/runner/src/connectors/*` - Current governed external capability layer.
- `packages/web/src/actions.ts` - Agent create/edit behavior.
- `packages/web/src/routes.ts` - Agent UI copy and forms.
- `packages/web/src/readers.ts` - Agent display and metadata reads.
- `packages/web/DOCS.md` - Web viewer docs.
- `docs/examples/web-research-email-agent.md` - Documentation-only example agent using context plus connector gates.
- `docs/testing/end-to-end-agent.md` - End-to-end docs should match the concept split.
- `tasks/CHANGELOG.md` - Update when complete.

## Tasks

- [x] 1.0 Lock the concept split in docs
  - [x] 1.1 Update `docs/ARCHITECTURE.md` with the concise boundary table: agent bundle, connector/tool, automation/task, run.
  - [x] 1.2 Update `docs/vision/strategy/agent.md` to describe skill-like agent richness as explicit contracts, not raw skills.
  - [x] 1.3 Update `tasks/vision.md` with the same four-line split.
  - [x] 1.4 Update `workspace/agents/README.md` so authors understand `AGENT.md`, `context/`, and future resource/memory/procedure directories.
  - [x] 1.5 Update connector docs to state that connectors own secrets, tool schemas, side-effect policy, and audit records.

- [x] 2.0 Define the agent bundle folder contract
  - [x] 2.1 Decide which directories are first-class now vs reserved for future use: `context/`, `references/`, `templates/`, `assets/`, `procedures/`, `scripts/`, `memory/`.
  - [x] 2.2 Keep current runtime minimal: only load `AGENT.md` and `context/*.md` unless explicitly implementing more.
  - [x] 2.3 Document reserved directories as non-loaded until implemented, so users do not assume hidden behavior.
  - [x] 2.4 Define naming and ordering rules for any future loaded resources.
  - [x] 2.5 Define where mutable agent-owned state should live if memory is added: inside agent folder, invocation workspace, or shared data store.

- [x] 3.0 Investigate Pi system prompt control for jumpyGoatHq runs
  - [x] 3.1 Read Pi docs and CLI behavior for `--system-prompt`, `--append-system-prompt`, `--skill`, context files, and JSON mode.
  - [~] 3.2 Run a small local experiment comparing generated agent file via `--skill` vs `--system-prompt`/`--append-system-prompt` if safe - Skipped: a model-bearing prompt comparison would spend tokens and was unnecessary after docs/source inspection plus backend smoke; decision does not require custom system prompt now.
  - [x] 3.3 Determine whether jumpyGoatHq should disable Pi context discovery with `--no-context-files` for scheduled/task runs, or keep it as useful project context.
  - [x] 3.4 Determine whether a custom jumpyGoatHq system prompt would improve policy clarity, connector guidance, and run framing.
  - [x] 3.5 Document the decision: generated `AGENT.md` injection is enough, or add explicit system prompt/append prompt support.

- [x] 4.0 Strengthen generated run instructions if needed
  - [x] 4.1 Inspect `packages/runner/src/agent.ts` generated instruction format.
  - [x] 4.2 Ensure generated instructions clearly separate agent identity, context, connector/tool availability, workspace rules, and output expectations.
  - [~] 4.3 If choosing a custom Pi system prompt, implement it narrowly in `packages/runner/src/pi.ts` with clear trace metadata - Skipped: chose generated instruction frame instead of custom system prompt.
  - [x] 4.4 Avoid duplicating large context across both system prompt and generated skill file.
  - [x] 4.5 Ensure task invocations and automation invocations share the same agent bundle semantics.

- [x] 5.0 Plan future agent memory/procedures without overbuilding
  - [x] 5.1 Draft a minimal v0 memory model inspired by Hermes: bounded curated memory, frozen at run start, updated through an explicit tool or domain service.
  - [x] 5.2 Decide whether memory is per-agent, per-project, per-user, or a combination.
  - [x] 5.3 Define `procedures/` or `references/` as reusable agent-local knowledge, distinct from connectors/tools.
  - [x] 5.4 Decide whether agent-created procedures are allowed before release, or deferred until after core primitives stabilize.
  - [x] 5.5 Keep any scripts/helper execution explicitly gated and auditable; do not let scripts become an ungoverned connector bypass.

- [x] 6.0 Update web UI and examples to match the split
  - [x] 6.1 Update agent creation template to describe the agent as identity/instructions/policy, not just a prompt file.
  - [x] 6.2 Show or document optional `context/` files and reserved agent resource directories where appropriate.
  - [x] 6.3 Add an example agent that uses context plus connector gates cleanly, e.g. web research + email notification.
  - [x] 6.4 Ensure automation/task screens present themselves as invocations of agents.
  - [x] 6.5 Avoid adding UI for unimplemented resource/memory directories until contracts exist.

- [x] 7.0 Validation and cleanup
  - [x] 7.1 Run `rg -n "skill|skills|SOUL|memory|connector" docs tasks packages workspace -g '*.md' -g '*.ts'` and classify stale language.
  - [x] 7.2 Run `pnpm validate:web` after web/docs-facing behavior changes.
  - [x] 7.3 Run `pnpm validate:backend` after runner/Pi invocation changes.
  - [~] 7.4 Run `pnpm validate` if both narrower validations pass and broad confidence is needed - Skipped: narrower web/backend validations both passed; full validate would repeat them and re-spend a backend smoke run.

- [x] 8.0 Finish and archive
  - [x] 8.1 Update `tasks/CHANGELOG.md` with the boundary clarification and any runtime changes.
  - [x] 8.2 Move this file to `tasks/done/YYYY-MM-DD_tasks-agent-bundle-boundaries.md` when complete.
