# Agent Entity — Scoped Context and Capabilities

## Completion Summary

Completed 2026-05-14. AgentHQ now uses agents as the runtime product entity: `AGENT.md` plus optional scoped context, `agent:` automations, agent-based runner/connectors/DB metadata, Agents web UI, updated smoke fixtures, docs, and validation.

## Goal

Introduce `agent` as the customer-facing runtime entity before release. An agent bundles Pi instructions, scoped markdown context, and connector capability configuration; cron/manual automations run an agent with a prompt. Do this as a breaking cleanup: replace the current automation→skill mental model with automation→agent, while keeping one shared run DB under `agenthqHome()/data/`.

## Notes

- Pre-release: breaking changes are acceptable; prefer a clean model over compatibility shims.
- No agent-level SQLite for now. Agent state/context should be markdown files only.
- Keep Pi as the agent harness; do not build a custom LLM/tool loop.
- Keep the single shared run DB at `agenthqHome()/data/agenthq.sqlite`.
- Proposed canonical local/deploy layout:
  - `agenthqHome()/agents/<agent>/AGENT.md`
  - `agenthqHome()/agents/<agent>/context/*.md` for optional scoped context files
  - `agenthqHome()/automations/<automation>.md` references `agent: <agent>`
- Agent frontmatter should own capabilities/defaults such as `allowedIntents`, connector enablement/defaults, and optional default model.
- Automation frontmatter should own schedule and optional run-specific model/connector overrides only if needed.

## Relevant Files

- `packages/shared/paths.js` - Add `agentsDir()`, `agentDir(name)`, and `agentPath(name)` helpers.
- `packages/shared/paths.d.ts` - Type declarations for new path helpers.
- `packages/runner/src/automation.ts` - Change automation schema from `skill` to `agent` and load agent references.
- `packages/runner/src/agent.ts` - Load agent metadata, instructions, and ordered scoped context files.
- `packages/runner/src/skill.ts` - Removed; replaced by agent metadata/context loading in `packages/runner/src/agent.ts`.
- `packages/runner/src/pi.ts` - Run Pi with generated/agent instruction file and agent-scoped cwd/context handling.
- `packages/runner/src/connectors/index.ts` - Update connector gates to use agent capabilities instead of skill capabilities.
- `packages/runner/src/connectors/resolve.ts` - Resolve connector plans from agent capabilities/defaults plus automation overrides.
- `packages/runner/src/connectors/legacy.ts` - Process legacy notification blocks against agent capabilities/config.
- `packages/web/src/trace-log.ts` - Display agent metadata in readable run traces.
- `agents/README.md` - Top-level pointer stub for active agents.
- `packages/runner/src/db.ts` - Consider DB column migration from `skill` to `agent` or additive `agent` column.
- `packages/runner/src/index.ts` - Update run metadata, trace events, and DB insert/finish calls for agent naming.
- `packages/web/src/paths.ts` - Export agent path helpers.
- `packages/web/src/readers.ts` - Replace skill readers with agent readers and context listing.
- `packages/web/src/actions.ts` - Replace skill CRUD with agent CRUD and validate automations against agents.
- `packages/web/src/routes.ts` - Replace Skills UI/routes with Agents UI/routes.
- `packages/web/src/html.ts` - Navigation labels if needed.
- `scripts/smoke-runner.ts` - Create temporary smoke agent and automation using `agent:`.
- `scripts/doctor.ts` - Report agents dir.
- `workspace/agents/README.md` - Canonical docs for local agent files.
- `workspace/automations/README.md` - Update automation examples to `agent:`.
- `skills/README.md` - Legacy pointer explaining agents replaced skills.
- `README.md` - Update setup/create/run mental model.
- `docs/ARCHITECTURE.md` - Update concepts and runtime flow to automation→agent→Pi.
- `docs/DEPLOY.md` - Include `$AGENTHQ_HOME/agents` in the VPS workspace layout.
- `packages/web/DOCS.md` - Update routes and safety constraints.
- `AGENTS.md` - Update hard constraints and package docs references.
- `.gitignore` - Ignore active `workspace/agents/*` while allowing README docs.
- `.env.example` - Update comments if connector examples mention skills.
- `tasks/CHANGELOG.md` - Update when complete.

## Tasks

- [x] 1.0 Define the agent file contract
  - [x] 1.1 Decide canonical agent layout: `agents/<name>/AGENT.md` plus optional `agents/<name>/context/*.md`.
  - [x] 1.2 Define `AGENT.md` frontmatter: `name`, `description`, optional `model`, `allowedIntents`, and connector config/defaults.
  - [x] 1.3 Define how context markdown is loaded and ordered, e.g. alphabetical `context/*.md` appended to instructions.
  - [x] 1.4 Decide whether automation-level connector config is removed entirely or retained as an optional per-run override.
  - [x] 1.5 Decide DB naming: migrate `runs.skill` to `runs.agent`, or add `agent` while leaving `skill` nullable for old rows.

- [x] 2.0 Add centralized agent paths and docs scaffolding
  - [x] 2.1 Add shared helpers for `agentsDir()`, `agentDir(name)`, `agentPath(name)`, and `agentContextDir(name)`.
  - [x] 2.2 Add `workspace/agents/README.md` with the canonical agent format and connector examples.
  - [x] 2.3 Update `.gitignore` to ignore active agent directories while committing `workspace/agents/README.md`.
  - [x] 2.4 Convert or remove legacy top-level `skills/README.md` messaging to point at agents.

- [x] 3.0 Refactor runner from skill-based to agent-based
  - [x] 3.1 Update automation parsing to require `agent` instead of `skill`.
  - [x] 3.2 Replace skill metadata loading with agent loading from `AGENT.md`.
  - [x] 3.3 Load optional agent context markdown and include it in the Pi instruction/prompt flow.
  - [x] 3.4 Update Pi invocation to use agent instructions while preserving Pi as the harness.
  - [x] 3.5 Update connector gate resolution to use agent `allowedIntents` and connector config/defaults.
  - [x] 3.6 Update run trace metadata, console output, and error messages from skill terminology to agent terminology.
  - [x] 3.7 Update DB schema/write/read logic for agent naming.

- [x] 4.0 Refactor web UI from Skills to Agents
  - [x] 4.1 Replace `/skills` routes/navigation with `/agents`.
  - [x] 4.2 Add agent create/edit/delete flows for raw `AGENT.md` and optional context files if simple.
  - [x] 4.3 Update automation create/edit forms to select an agent.
  - [x] 4.4 Validate automation references against existing agents.
  - [x] 4.5 Update dashboard/run tables/details to display agent names.

- [x] 5.0 Update scripts and validation fixtures
  - [x] 5.1 Update backend smoke fixture to create a temporary agent and `agent:` automation.
  - [x] 5.2 Update doctor/setup diagnostics to include `agentsDir()`.
  - [x] 5.3 Update cron helpers only if automation schema changes affect install/list behavior.
  - [x] 5.4 Update tests and Playwright expectations from Skills to Agents.

- [x] 6.0 Update documentation
  - [x] 6.1 Update `README.md` to explain repo code vs `AGENTHQ_HOME`, agents, automations, and connectors.
  - [x] 6.2 Update `docs/ARCHITECTURE.md` with automation→agent→Pi runtime flow.
  - [x] 6.3 Update `docs/DEPLOY.md` to create `$AGENTHQ_HOME/{agents,automations,data,workspaces,traces}`.
  - [x] 6.4 Update `packages/web/DOCS.md` route list and safety constraints.
  - [x] 6.5 Update `AGENTS.md` hard constraints and package docs references.
  - [x] 6.6 Update workspace README docs for agents and automations.

- [x] 7.0 Remove or archive obsolete skill assumptions
  - [x] 7.1 Remove runtime dependency on `agenthqHome()/skills` if agents fully replace skills.
  - [x] 7.2 Rename code/types/functions where practical from `Skill` to `Agent` to reduce confusion.
  - [x] 7.3 Keep only intentional legacy pointer docs if top-level `skills/` remains.
  - [x] 7.4 Search for stale `skill` docs, UI labels, route names, and DB references.

- [x] 8.0 Validate
  - [x] 8.1 Run `pnpm build`.
  - [x] 8.2 Run `pnpm validate:web` and inspect Playwright output.
  - [x] 8.3 Run `pnpm validate:backend` if local Pi auth/provider availability is expected.
  - [x] 8.4 Manually verify creating an agent and automation through the web UI writes under `workspace/`.
  - [x] 8.5 Manually verify `AGENTHQ_HOME=/tmp/agenthq-agent-test pnpm ...` uses external `agents/` and `automations/` paths.

## Decisions

- Use a breaking pre-release transition rather than maintaining skill compatibility indefinitely.
- Do not add per-agent SQLite yet; scoped agent data/context is markdown-only for this iteration.

## Changelog

- 2026-05-14: Implemented agent entity refactor: agents/AGENT.md + context loading, automation `agent:` schema, agent-based runner/connectors/DB metadata, Agents web UI, smoke fixtures, docs, and validation.
