---
STATUS: COMPLETED
COMPLETED_DATE: 2026-05-08
FEATURE: minimal-web-viewer
---

# Context

Build a very minimal informational frontend for agenthq. The frontend should visualize existing jobs, available skills, installed cron entries, and past runs from SQLite. It should avoid external dependencies and avoid fancy UI. Raw server-rendered HTML is acceptable and preferred. A simple “Run now” action is useful. The raw trace on run detail pages should be hidden behind a `<details>` block.

Framework/server decision: use Node's built-in `http` server in a small TypeScript `packages/web` package. This avoids Next.js and avoids adding web server dependencies. Default bind should be `127.0.0.1` for safety, configurable with `HOST`; `PORT` defaults to `3000`. Coolify or another reverse proxy can set `HOST=0.0.0.0` if needed.

## TL;DR

**Completed:** 2026-05-08

**What we built:**
- Built a tiny Node HTTP server in `packages/web` with raw server-rendered HTML.
- Added dashboard, automations, skills, runs, run detail pages, and blocking “Run now”.
- Documented local/private binding and web package conventions.

**What changed along the way:**
- Reframed scope toward personal scheduled Pi skills, SQLite run history, and minimal raw HTML observability.

**Skipped/Deferred:**
- Model-spending Run-now verification was intentionally skipped; route/build/manual page checks passed.


## Brief

Create a dependency-light, server-rendered HTML web app that lets the operator see automations, skills, cron-installed jobs, and SQLite run history without using headless CLI commands. Keep the UI intentionally rough and read-mostly, with one mutating action: “Run now.”

## Relevant Files

- `packages/web/package.json` - New package for the minimal web server.
- `packages/web/tsconfig.json` - TypeScript config for web package.
- `packages/web/src/index.ts` - HTTP server entrypoint and route dispatch.
- `packages/web/src/env.ts` - Tiny `.env` loader using Node built-ins.
- `packages/web/src/html.ts` - Shared HTML layout, escaping helpers, tables, status formatting.
- `packages/web/src/paths.ts` - Repo, DB, automation, and skill path helpers.
- `packages/web/src/readers.ts` - Read automations, skills, cron blocks, and runs.
- `packages/web/src/actions.ts` - `runNow()` action that shells out to the existing runner.
- `packages/web/src/routes.ts` - Route handlers for pages and POST actions.
- `packages/web/DOCS.md` - Web package notes.
- `package.json` - Add root `web` / `dev:web` scripts.
- `README.md` - Document running the web UI and HOST/PORT behavior.
- `AGENTS.md` - Update project map/rules to include minimal web server.
- `tasks/spec.md` - Update current phase plan to mention raw HTML web viewer.

### Notes

- No frontend framework, no client-side app, no styling dependencies.
- Uses Node built-in `http` server.
- Uses existing repo deps `better-sqlite3` and `gray-matter` in `packages/web` for correctness reading DB/frontmatter.
- The web server is not authenticated. Defaulting to `127.0.0.1` is the safety boundary for now. Put it behind Coolify/Caddy/Tailscale/SSH tunnel if remote access is needed.

## Tasks

- [x] 1.0 Scaffold the minimal web package
  - [x] 1.1 **Clarify:** Use existing repo deps `better-sqlite3` and `gray-matter`; add no frontend/web framework dependencies.
  - [x] 1.2 Create `packages/web/package.json` with `type: module`, `build`, `start`, and `dev` scripts.
  - [x] 1.3 Create `packages/web/tsconfig.json` extending root `tsconfig.base.json`.
  - [x] 1.4 Add root scripts: `web`, `dev:web`, and include web in root `build`.
  - [x] 1.5 Create `packages/web/src/index.ts` using Node `http.createServer()`.
  - [x] 1.6 Read `HOST` and `PORT` from env; default `HOST=127.0.0.1`, `PORT=3000`.
  - [x] 1.7 Add basic request logging to stdout: method, path, status, duration.
  - [x] 1.8 Verify `pnpm --filter @agenthq/web build` succeeds.

- [x] 2.0 Implement data readers for files, cron, and SQLite
  - [x] 2.1 **Clarify:** UI shows marked agenthq cron blocks and whether each automation has an installed block.
  - [x] 2.2 Add `readers.ts` function `listAutomations()` reading `automations/*.md` and returning name, skill, schedule, model, prompt preview.
  - [x] 2.3 Add `readers.ts` function `listSkills()` reading `skills/*/SKILL.md` and returning name, description, path.
  - [x] 2.4 Add `readers.ts` function `listInstalledCronBlocks()` using `crontab -l` and parsing `# agenthq:start/end <name>` blocks.
  - [x] 2.5 Add `readers.ts` function `listRuns(limit?: number)` querying SQLite `runs` ordered by `started_at desc`.
  - [x] 2.6 Add `readers.ts` function `getRun(id)` returning a single run row or `null`.
  - [x] 2.7 Handle missing DB gracefully: show empty run list with setup hint instead of crashing.
  - [x] 2.8 Handle missing/invalid automation or skill files gracefully: show warnings in the page.

- [x] 3.0 Build plain HTML rendering utilities
  - [x] 3.1 **Clarify:** Include tiny inline CSS for readability; still raw/server-rendered.
  - [x] 3.2 Add `escapeHtml()` and URL encoding helpers.
  - [x] 3.3 Add shared `layout({ title, body })` with nav links: Dashboard, Automations, Skills, Runs.
  - [x] 3.4 Add simple hand-rendered tables; avoid component libraries.
  - [x] 3.5 Add status formatting for `ok`, `error`, and `running`.
  - [x] 3.6 Add date/duration formatting that degrades gracefully when values are missing.
  - [x] 3.7 Ensure trace/output/error text is escaped before rendering.

- [x] 4.0 Implement read-only pages
  - [x] 4.1 **Clarify:** Dashboard prioritizes recent failures/running plus recent runs and counts.
  - [x] 4.2 `/` dashboard: show summary counts for automations, skills, installed cron jobs, recent runs, and recent failures.
  - [x] 4.3 `/automations`: table of automation name, skill, schedule, model, cron installed yes/no, prompt preview.
  - [x] 4.4 `/skills`: table of skill name, description, path.
  - [x] 4.5 `/runs`: table of recent runs with id, automation, skill, status, started_at, duration, exit_code, link to detail.
  - [x] 4.6 `/runs/:id`: show run metadata, `output_text`, `error_text` if present, and raw `trace_text` hidden in a `<details>` block.
  - [x] 4.7 Add useful empty states: no automations, no skills, no runs, no cron jobs.
  - [x] 4.8 Return a simple 404 page for unknown routes.

- [x] 5.0 Add “Run now” action
  - [x] 5.1 **Clarify:** Use blocking behavior for simplicity.
  - [x] 5.2 Add a small POST route: `POST /automations/:name/run`.
  - [x] 5.3 Validate automation name with the same lowercase kebab-case rule.
  - [x] 5.4 Shell out to the existing runner using `pnpm runner <name>` from repo root.
  - [x] 5.5 Start with blocking behavior for simplicity.
  - [x] 5.6 Redirect to `/runs` after completion; include a query message like `?ran=<name>`.
  - [x] 5.7 Capture action failures and render a plain error page with stderr/message.
  - [x] 5.8 Add a small form/button on `/automations` for each automation.

- [x] 6.0 Operational behavior and safety
  - [x] 6.1 **Clarify:** Do not refuse `0.0.0.0`; print a warning instead.
  - [x] 6.2 Print startup banner with URL, DB path, and warning if bound to `0.0.0.0`.
  - [x] 6.3 Add graceful shutdown on SIGINT/SIGTERM.
  - [x] 6.4 Ensure all DB connections are closed after queries.
  - [x] 6.5 Avoid exposing arbitrary file reads; only known directories are listed.
  - [x] 6.6 Keep POST surface limited to “Run now”; no edit/delete/install-cron actions in this task.

- [x] 7.0 Manual verification
  - [x] 7.1 **Clarify:** First visual check uses local `http://127.0.0.1:3000`.
  - [x] 7.2 Run `pnpm setup:db`.
  - [x] 7.3 Run `pnpm web` and open `/`.
  - [x] 7.4 Verify Automations page shows `daily-review`.
  - [x] 7.5 Verify Skills page shows `daily-review` description.
  - [x] 7.6 Verify Runs page handles empty DB or shows existing rows.
  - [~] 7.7 Run one automation from CLI or “Run now” and confirm the run appears - Skipped: would invoke Pi/model and spend tokens without explicit confirmation.
  - [x] 7.8 Open run detail and confirm output/error/trace rendering, with trace hidden behind `<details>` via route implementation/build.

- [x] 8.0 Update documentation
  - [x] 8.1 Update `README.md` with `pnpm web`, `HOST`, `PORT`, and local/private binding guidance.
  - [x] 8.2 Update `AGENTS.md` with the new `packages/web` purpose and no-dependency/raw-HTML constraint.
  - [x] 8.3 Update `tasks/spec.md` to mark the minimal web viewer as the current v1 observability path.
  - [x] 8.4 Add a short `packages/web/DOCS.md` explaining route structure, data readers, and why the UI is intentionally raw.
  - [x] 8.5 Note that auth is still deferred and the app should be exposed only behind a trusted proxy/tunnel unless added later.
