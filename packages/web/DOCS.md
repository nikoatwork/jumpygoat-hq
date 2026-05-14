# packages/web

Minimal raw HTML operator viewer for agenthq.

## Why this is intentionally small

The web UI is informational. It uses Node's built-in `http` server and server-rendered HTML strings. No frontend framework, no client-side routing, no component library.

## Routes

- `GET /` — dashboard summary
- `GET /automations` — automation files + cron-installed status + Run now/edit/delete forms
- `GET /automations/new` — create automation form
- `POST /automations` — validate and create `agenthqHome()/automations/<name>.md`
- `GET /automations/:name` — automation detail view
- `GET /schedule` — read-only 7-day agenda for scheduled agent runs, cron install status, and orphan AgentHQ cron block warnings
- `GET /automations/:name/edit` — edit automation form
- `POST /automations/:name` — validate and update `agenthqHome()/automations/<name>.md`
- `POST /automations/:name/delete` — confirmed delete for `agenthqHome()/automations/<name>.md`
- `POST /automations/:name/run` — blocking `pnpm runner <name>`, then redirects to `/runs`
- `GET /agents` — available agents + view/edit/delete forms
- `GET /agents/new` — create agent form with a minimal template
- `POST /agents` — validate and create `agenthqHome()/agents/<name>/AGENT.md`
- `GET /agents/:name` — raw agent detail view
- `GET /agents/:name/edit` — raw `AGENT.md` editor
- `POST /agents/:name` — validate and update `agenthqHome()/agents/<name>/AGENT.md`
- `POST /agents/:name/delete` — confirmed delete, blocked while referenced by automations
- `GET /projects` — project list from `agenthqHome()/projects/*/PROJECT.md`
- `GET /projects/new` / `POST /projects` — create project markdown
- `GET /projects/:project` / `GET /projects/:project/edit` / `POST /projects/:project` — view/edit project markdown
- `GET /tasks` — kanban grouped by task status, optionally `?project=<project>`
- `GET /tasks/new` / `POST /tasks` — create task markdown
- `GET /projects/:project/tasks/:task` — task detail and status buttons
- `GET /projects/:project/tasks/:task/edit` / `POST /projects/:project/tasks/:task` — edit task markdown
- `POST /projects/:project/tasks/:task/status` — non-JS and drag/drop status updates
- `GET /runs` — recent SQLite runs
- `GET /runs/:id` — run detail, derived readable trace timeline, output/error, raw trace JSONL hidden in `<details>`

## Files

- `src/index.ts` — HTTP server and startup/shutdown
- `src/routes.ts` — route handlers
- `src/readers.ts` — SQLite, automation, agent, project/task, and crontab readers
- `src/actions.ts` — mutating actions, validation, canonical markdown serialization, atomic file writes, task status updates, and Run now
- `src/html.ts` — layout and escaping helpers

## UI conventions

The web UI has a deliberately small, server-rendered design system:

- Do not add frontend dependencies, React, Tailwind, CSS-in-JS, component libraries, bundlers, client-side routing, or a build step for styling.
- Keep common CSS in `public/styles.css` using semantic classes over broad utility sprawl.
- Use shared helpers from `src/html.ts` for repeated patterns: `pageHeader`, `section`, `toolbar`, `inlineActions`, `notice`, `badge`, `emptyState`, `table`, and `metaTable`.
- Prefer canonical classes for route markup: `.page-header`, `.page-actions`, `.section`, `.toolbar`, `.inline-actions`, `.empty-state`, `.notice`, `.badge`, `.form-stack`, `.form-grid`, `.table-wrap`, and `.meta-table`.
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

- Files remain the source of truth; the web UI is only a convenience layer over gitignored instance files under `agenthqHome()` (`workspace/` locally by default, or `AGENTHQ_HOME` when set).
- Names are restricted to lowercase letters, numbers, and hyphens to prevent path traversal and stay compatible with runner/cron scripts.
- Automations validate required agent, schedule, prompt, and optional model before writing.
- `/schedule` is read-only: automation markdown schedules are the source of truth; installed AgentHQ crontab blocks are displayed only as status/evidence, including orphan or malformed blocks.
- Agents are edited as raw markdown and delete is blocked while any automation references the agent.
- Projects and tasks are markdown source of truth under `agenthqHome()/projects`; kanban drag/drop posts to the same status route as non-JS buttons.
- Mutations use POST with redirect-after-post on success.

## Binding

Defaults:

```txt
HOST=127.0.0.1
PORT=3000
```

Use `HOST=0.0.0.0` only behind a trusted proxy/auth layer such as Coolify, Caddy, Tailscale, or SSH tunnel.
