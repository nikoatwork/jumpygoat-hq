# agenthq agent map

Use this file as a map. Detailed product/runtime docs live elsewhere.

## Start here

- Strategy/north star: `docs/vision/strategy/agent.md`
- Vision: `tasks/vision.md`
- Target spec/phase plan: `tasks/spec.md`
- Architecture/current target: `docs/ARCHITECTURE.md`
- End-to-end agent testing guide: `docs/testing/end-to-end-agent.md`
- Canonical task changelog: `tasks/CHANGELOG.md`
- Completed local MVP task: `tasks/done/2026-05-08_tasks-01-local-mvp.md`
- Completed minimal web task: `tasks/done/2026-05-08_tasks-04-minimal-web.md`
- Open tasks: `tasks/todo/`

## Package docs

- Web viewer: `packages/web/DOCS.md`
- Runner implementation: see `packages/runner/src/`
- Agents contract: `workspace/agents/README.md` (top-level `agents/README.md` is a pointer stub)
- Automations contract: `workspace/automations/README.md` (top-level `automations/README.md` is a pointer stub)
- Projects/tasks contract: `workspace/projects/README.md`
- Legacy skills pointer: `workspace/skills/README.md`

## Local validation loop

- After web/frontend changes, run `pnpm validate:web` and inspect Playwright output before claiming success.
- After runner/backend/Pi changes, run `pnpm validate:backend`; it creates/runs one temporary gitignored smoke automation by default and prints output/error/trace tails in-session.
- For broad confidence, run `pnpm validate` from the repo root.
- Backend validation requires local Pi auth/provider availability and may call OpenAI Codex.
- Do not run every automation, install cron, or persist extra artifacts beyond gitignored runtime state as part of normal validation.

## Hard constraints

- Pre-release breaking changes are allowed when they clarify primitives; do not preserve legacy skill-facing concepts solely for compatibility.
- agenthq should be the smallest useful open-source Hermes/OpenClaw-like agent operations layer: strong primitives, limited features, clear extension seams.
- Pi is the agent harness; do not build a custom LLM/tool loop unless Pi blocks us.
- Agents are the product entity: `agenthqHome()/agents/<name>/AGENT.md` plus optional context in `context/*.md`.
- Automations are single markdown files with YAML frontmatter under `agenthqHome()/automations/` and reference `agent: <name>`.
- Projects/tasks are markdown under `agenthqHome()/projects/<project>/PROJECT.md` and `tasks/<task-id>.md`; tasks assign to agents with `assignee: <name>`.
- Runtime/personal state is gitignored: `.env`, `.env.local`, local `workspace/{agents,automations,skills,projects,data,workspaces,traces}`, legacy `data/`, legacy `workspaces/`, active top-level `agents/*`, `skills/*`, and active top-level `automations/*.md`.
- Web UI is intentionally minimal raw HTML; avoid frontend frameworks unless the constraint changes.
- Auth is deferred; bind web locally by default or put it behind trusted proxy/auth.
- Chat/browser/Slack surfaces must mutate only user-owned AgentHQ workspace content through domain services; no repo-wide shell/write access.
