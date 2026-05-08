---
STATUS: COMPLETED
COMPLETED_DATE: 2026-05-08
FEATURE: self-validating-loop
---

# Context

Set up a lean self-validating development loop for this repo so coding agents can quickly tell whether their changes worked. Current work includes a basic Node HTTP server/frontend. Validation should cover frontend changes via Playwright during local development and backend behavior via a smoke script that runs one representative automation, likely `daily-review`, through Pi/OpenAI Codex. The agent should receive raw command output/traces in-session and be able to evaluate whether the run succeeded. Local-only is fine; no CI required. Avoid persisting extra artifacts unless necessary. Ideally expose this as one or two project skills/commands the coding agent can call.

## TL;DR

**Completed:** 2026-05-08

**What we built:**
- Added `pnpm validate:web`, `pnpm validate:backend`, and `pnpm validate` as the local self-validation interface.
- Added Playwright smoke tests for the raw HTML viewer and a backend smoke script that runs one Pi-backed automation.
- Added an `agenthq-validate` skill plus README/AGENTS/package docs so coding agents know how to run and interpret validation.

**What changed along the way:**
- Kept validation local-only and stdout/stderr-first instead of adding CI or durable report artifacts.
- Made backend smoke configurable via `AGENTHQ_SMOKE_AUTOMATION` while defaulting to `daily-review`.

**Skipped/Deferred:**
- CI integration and exhaustive automation validation are intentionally deferred.

## Brief

Create a very small validation layer for agenthq that gives coding agents confidence in frontend and backend changes. Keep it local, cheap to invoke, and focused on one representative frontend check plus one Pi-backed automation smoke run.

## Relevant Files

- `package.json` - Adds `validate:web`, `validate:backend`, and `validate` scripts.
- `pnpm-lock.yaml` - Records the Playwright test dependency.
- `.gitignore` - Ignores Playwright failure artifacts.
- `playwright.config.ts` - Local Playwright config with web server startup and minimal reporter output.
- `tests/web/smoke.spec.ts` - Playwright smoke tests for the raw HTML frontend.
- `scripts/smoke-runner.ts` - Backend validation script that runs one automation and summarizes the result.
- `skills/agenthq-validate/SKILL.md` - Project skill that tells a coding agent how to run and interpret validation.
- `README.md` - Documents local validation commands for humans.
- `AGENTS.md` - Documents the self-validation loop for coding agents.
- `packages/web/DOCS.md` - Notes web validation coverage.

### Notes

- Keep validation local-only; no CI wiring is required.
- The backend smoke check runs the real `daily-review` automation through Pi by default. It does not run all automations.
- The goal is agent observability, not durable reports. Prefer stdout/stderr summaries and traces over saved artifacts.
- Playwright checks high-signal UI behavior, not pixel perfection.
- Scripts fail non-zero when validation fails and print enough context for the coding agent to diagnose the issue.

## Tasks

- [x] 1.0 Define the local validation contract
  - [x] 1.1 **Clarify:** What exact evidence should convince the coding agent that a frontend or backend change worked? - Frontend: Playwright smoke pass. Backend: one Pi run writes an ok runs row with output or trace.
  - [x] 1.2 Define the minimum command set, likely `pnpm validate:web`, `pnpm validate:backend`, and optionally `pnpm validate`.
  - [x] 1.3 Decide whether validation scripts live at repo root or inside `packages/web` / `packages/runner`.
  - [x] 1.4 Define expected stdout sections: command run, pass/fail summary, key observations, and raw trace tail when useful.
  - [x] 1.5 Ensure failed validation exits non-zero and successful validation exits zero.

- [x] 2.0 Add frontend Playwright validation for the minimal web UI
  - [x] 2.1 **Clarify:** Which page is the required first confidence check: dashboard, automations, runs, or run detail? - Dashboard plus automations and runs smoke coverage.
  - [x] 2.2 Add Playwright as a local dev dependency in the smallest reasonable scope.
  - [x] 2.3 Add `playwright.config.ts` with local web server startup using `pnpm web` or `pnpm dev:web`.
  - [x] 2.4 Configure the test base URL as local `127.0.0.1`, defaulting to port `3123` for validation and env-overridable.
  - [x] 2.5 Add a smoke test that loads `/` and verifies core navigation or summary content renders.
  - [x] 2.6 Add a smoke test for `/automations` that verifies `daily-review` is visible and the page has a Run action if implemented.
  - [x] 2.7 Add a smoke test for `/runs` that accepts either an empty state or visible run rows.
  - [x] 2.8 Keep screenshots/traces off by default unless a failure occurs or the user opts in.

- [x] 3.0 Add backend smoke validation for one representative automation
  - [x] 3.1 **Clarify:** Should the backend smoke use `daily-review` permanently, or should the automation name be configurable with a default? - Configurable via `AGENTHQ_SMOKE_AUTOMATION`, default `daily-review`.
  - [x] 3.2 Create a script that runs `pnpm setup:db` before the smoke run.
  - [x] 3.3 Run exactly one automation by default, initially `pnpm runner daily-review`.
  - [x] 3.4 Capture stdout/stderr from the runner and print a compact agent-readable summary.
  - [x] 3.5 Verify a new or recent `runs` row exists for the automation after the command finishes.
  - [x] 3.6 Verify the run status, exit code, and presence of useful output or trace text.
  - [x] 3.7 On failure, print the runner stderr and relevant trace/output tail so the agent can reason about the failure in-session.
  - [x] 3.8 Avoid running every automation or mutating cron state.

- [x] 4.0 Create agent-facing validation skill(s) or instructions
  - [x] 4.1 **Clarify:** Should this be one combined skill or two narrower skills for frontend and backend validation? - One combined skill for lean discoverability.
  - [x] 4.2 Add a project skill like `skills/agenthq-validate/SKILL.md` that explains when to run frontend, backend, or combined validation.
  - [x] 4.3 Include interpretation rules: what counts as pass, soft warning, or hard failure.
  - [x] 4.4 Tell the coding agent to inspect raw stdout/stderr before declaring success.
  - [x] 4.5 Keep the skill short enough that it is practical to load during normal coding work.

- [x] 5.0 Wire lean package scripts for easy local invocation
  - [x] 5.1 **Clarify:** Should `pnpm validate` include the Pi-backed backend smoke by default, given it may consume model/API usage? - Yes; separate `validate:web` remains available for cheaper checks.
  - [x] 5.2 Add `validate:web` for Playwright-only validation.
  - [x] 5.3 Add `validate:backend` for the single-automation Pi-backed smoke run.
  - [x] 5.4 Add `validate` as either both checks or a lightweight wrapper that clearly states what it runs.
  - [x] 5.5 Ensure commands work from the repo root.
  - [x] 5.6 Ensure commands have clear names so future agents can discover them via `package.json`.

- [x] 6.0 Document the self-validating loop for future coding agents
  - [x] 6.1 **Clarify:** Should documentation emphasize agent usage first, human developer usage first, or both equally? - Both, with `AGENTS.md` agent-first and `README.md` human-friendly.
  - [x] 6.2 Update `AGENTS.md` with when to run `validate:web`, `validate:backend`, and `validate`.
  - [x] 6.3 Update `README.md` with local-only validation setup and expected prerequisites.
  - [x] 6.4 Note that backend validation requires Pi login/provider availability and may call OpenAI Codex.
  - [x] 6.5 Note that frontend validation requires Playwright browsers installed locally.
  - [x] 6.6 Add troubleshooting notes for common failures: port in use, missing DB, Pi auth missing, no browser installed.
