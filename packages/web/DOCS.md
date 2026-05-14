# packages/web

Minimal raw HTML operator viewer for jumpyGoatHq.

## Why this is intentionally small

The web UI is informational. It uses Node's built-in `http` server and server-rendered HTML strings. No frontend framework, no client-side routing, no component library.

## Routes

- `GET /` — dashboard summary, including task heartbeat cron status
- `GET /automations` — automation files + cron-installed status + Run now/edit/delete forms
- `GET /automations/new` — create automation form
- `POST /automations` — validate and create `jumpyGoatHqHome()/automations/<name>.md`
- `GET /automations/:name` — automation detail view
- `GET /schedule` — read-only 7-day agenda for scheduled agent runs, cron install status, and orphan jumpyGoatHq cron block warnings
- `GET /automations/:name/edit` — edit automation form
- `POST /automations/:name` — validate and update `jumpyGoatHqHome()/automations/<name>.md`
- `POST /automations/:name/delete` — confirmed delete for `jumpyGoatHqHome()/automations/<name>.md`
- `POST /automations/:name/run` — blocking `pnpm runner <name>`, then redirects to `/runs`
- `GET /agents` — available agents + view/edit/delete forms
- `GET /agents/new` — create agent form with a bundle-oriented `AGENT.md` template for identity, policy, connector gates, and output expectations
- `POST /agents` — validate and create `jumpyGoatHqHome()/agents/<name>/AGENT.md`
- `GET /agents/:name` — raw agent detail view
- `GET /agents/:name/edit` — raw `AGENT.md` editor
- `POST /agents/:name` — validate and update `jumpyGoatHqHome()/agents/<name>/AGENT.md`
- `POST /agents/:name/delete` — confirmed delete, blocked while referenced by automations
- `GET /boards` — board list from `jumpyGoatHqHome()/boards/*/BOARD.md`
- `GET /boards/new` / `POST /boards` — create board markdown
- `GET /boards/:board` / `GET /boards/:board/edit` / `POST /boards/:board` — view/edit board markdown
- `GET /tasks` — kanban grouped by task status, optionally `?board=<board>` and focused with `?status=<status>`, plus task heartbeat cron status
- `GET /tasks/new` / `POST /tasks` — create task markdown
- `GET /boards/:board/tasks/:task` — task detail and status buttons
- `GET /boards/:board/tasks/:task/edit` / `POST /boards/:board/tasks/:task` — edit task markdown
- `POST /boards/:board/tasks/:task/status` — non-JS and drag/drop status updates
- `GET /runs` — recent SQLite runs
- `GET /runs/:id` — run detail, requested/resolved model audit, best-effort Pi-emitted usage, derived readable trace timeline, output/error, raw trace JSONL hidden in `<details>`
- `GET /settings` — read/edit instance-local `jumpyGoatHqHome()/settings.yml`, list semantic model profiles, and show usage grouped by model/profile
- `POST /settings` — validate settings YAML before atomically replacing the previous file

## Files

- `src/index.ts` — HTTP server and startup/shutdown
- `src/routes.ts` — route handlers
- `src/readers.ts` — SQLite, automation, agent, settings, usage summary, board/task, crontab, and task heartbeat status readers
- `src/actions.ts` — mutating actions, validation, canonical markdown/settings serialization, atomic file writes, task status updates, and Run now
- `src/html.ts` — layout and escaping helpers

## UI conventions

The web UI uses a persistent sidebar information hierarchy: Overview; Work (Tasks, Boards); Automations (All automations, Schedule); Agents; Activity (Runs); and Settings in the sidebar footer. Schedule is visually grouped under Automations because it is a timeline view of automation markdown schedules, not a separate source object.

The web UI has a deliberately small, server-rendered design system:

- Do not add frontend dependencies, React, Tailwind, CSS-in-JS, component libraries, bundlers, client-side routing, or a build step for styling.
- Keep common CSS in `public/styles.css` using semantic classes over broad utility sprawl.
- Use shared helpers from `src/html.ts` for repeated patterns: `pageHeader`, `section`, `toolbar`, `inlineActions`, `notice`, `badge`, `emptyState`, `table`, and `metaTable`.
- Prefer canonical classes for route markup: `.app-shell`, `.sidebar`, `.sidebar-nav`, `.nav-link`, `.page-header`, `.page-actions`, `.section`, `.toolbar`, `.inline-actions`, `.empty-state`, `.notice`, `.badge`, `.form-stack`, `.form-grid`, `.table-wrap`, and `.meta-table`.
- Keep true page-specific layout CSS page-specific. Current examples include `.kanban-*`, `.agenda-*`, `.trace-*`, and `.schedule-*` rules.

Common route patterns:

```ts
pageHeader("Automations", { actions: `<a class="button-link" href="/automations/new">Create automation</a>` });
table(["Name", "Action"], rows, { empty: "No automations found." });
notice("created: daily-report", "success");
badge("installed", "installed");
```

Use `form-stack` for simple vertical forms and `form-grid` for compact field groups. Use `raw(...)` only for intentional trusted HTML fragments from route code; helper text values escape by default.

Reconsider a React/client-heavy migration only if the product needs a genuinely interactive operator console that cannot stay clear with server-rendered HTML plus small progressive-enhancement scripts.

## Local validation

Run `pnpm check:design` for the lightweight design-system guardrails. Run `pnpm validate:web` from the repo root for web build + Playwright smoke coverage. It starts the web server locally, checks the dashboard, automations page, schedule page, and runs page, and retains screenshots/traces only on failure.

## Safety constraints

- Files remain the source of truth; the web UI is only a convenience layer over gitignored instance files under `jumpyGoatHqHome()` (`workspace/` locally by default, or `JUMPYGOATHQ_HOME` when set).
- Names are restricted to lowercase letters, numbers, and hyphens to prevent path traversal and stay compatible with runner/cron scripts.
- Automations validate required agent, schedule, prompt, and optional model before writing. Optional model values can be semantic profile keys from `/settings` or direct Pi selectors.
- `/schedule` is read-only: automation markdown schedules are the source of truth; installed automation crontab blocks are displayed only as status/evidence, including orphan or malformed blocks. The separate task heartbeat cron status appears on Overview and Tasks.
- Agents are edited as raw markdown and delete is blocked while any automation references the agent. The UI intentionally exposes only `AGENT.md`; optional `context/*.md` files and reserved resource directories remain file-authored until richer contracts exist.
- Boards and tasks are markdown source of truth under `jumpyGoatHqHome()/boards`; kanban drag/drop posts to the same status route as non-JS buttons.
- `/settings` writes only `jumpyGoatHqHome()/settings.yml`, validates before replacing the previous file, and must not collect secrets/API keys; Pi/provider auth remains outside the web UI.
- Mutations use POST with redirect-after-post on success.

## Binding

Defaults:

```txt
HOST=127.0.0.1
PORT=3000
```

Use `HOST=0.0.0.0` only behind a trusted proxy/auth layer such as Coolify, Caddy, Tailscale, or SSH tunnel.
