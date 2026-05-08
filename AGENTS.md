# agenthq agent map

Use this file as a map. Detailed product/runtime docs live elsewhere.

## Start here

- Architecture/status quo: `docs/ARCHITECTURE.md`
- Vision: `tasks/vision.md`
- Spec/phase plan: `tasks/spec.md`
- Task changelog: `tasks/CHANGELOG.md`
- Completed local MVP task: `tasks/done/2026-05-08_tasks-01-local-mvp.md`
- Completed minimal web task: `tasks/done/2026-05-08_tasks-04-minimal-web.md`
- Open tasks: `tasks/todo/`

## Package docs

- Web viewer: `packages/web/DOCS.md`
- Runner implementation: see `packages/runner/src/`
- Skills contract: `skills/README.md`
- Automations contract: `automations/README.md`

## Local validation loop

- After web/frontend changes, run `pnpm validate:web` and inspect Playwright output before claiming success.
- After runner/backend/Pi changes, run `pnpm validate:backend`; it runs one automation (`daily-review` by default) and prints output/error/trace tails in-session.
- For broad confidence, run `pnpm validate` from the repo root.
- Backend validation requires local Pi auth/provider availability and may call OpenAI Codex.
- Do not run every automation, install cron, or persist extra artifacts as part of normal validation.
- Agent-facing validation instructions live in `skills/agenthq-validate/SKILL.md`.

## Hard constraints

- Pi is the agent harness; do not build a custom LLM/tool loop unless Pi blocks us.
- Automations are single markdown files with YAML frontmatter.
- Skills live in `skills/<name>/SKILL.md` and follow Pi/Agent Skills format.
- Runtime state is gitignored: `.env`, `data/`, `workspaces/`.
- Web UI is intentionally minimal raw HTML; avoid frontend frameworks unless the constraint changes.
- Auth is deferred; bind web locally by default or put it behind trusted proxy/auth.
