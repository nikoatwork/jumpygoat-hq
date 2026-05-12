# packages/web

Minimal raw HTML viewer for jumpyGoat.

## Why this is intentionally small

The web UI is informational. It uses Node's built-in `http` server and server-rendered HTML strings. No frontend framework, no client-side routing, no component library.

## Routes

- `GET /` — dashboard summary
- `GET /automations` — automation files + cron-installed status + Run now/edit/delete forms
- `GET /automations/new` — create automation form
- `POST /automations` — validate and create `automations/<name>.md`
- `GET /automations/:name` — automation detail view
- `GET /automations/:name/edit` — edit automation form
- `POST /automations/:name` — validate and update `automations/<name>.md`
- `POST /automations/:name/delete` — confirmed delete for `automations/<name>.md`
- `POST /automations/:name/run` — blocking `pnpm runner <name>`, then redirects to `/runs`
- `GET /skills` — available Pi skills + view/edit/delete forms
- `GET /skills/new` — create skill form with a minimal template
- `POST /skills` — validate and create `skills/<name>/SKILL.md`
- `GET /skills/:name` — raw skill detail view
- `GET /skills/:name/edit` — raw `SKILL.md` editor
- `POST /skills/:name` — validate and update `skills/<name>/SKILL.md`
- `POST /skills/:name/delete` — confirmed delete, blocked while referenced by automations
- `GET /runs` — recent SQLite runs
- `GET /runs/:id` — run detail, derived readable trace timeline, output/error, raw trace JSONL hidden in `<details>`

## Files

- `src/index.ts` — HTTP server and startup/shutdown
- `src/routes.ts` — route handlers
- `src/readers.ts` — SQLite, automation, skill, and crontab readers
- `src/actions.ts` — mutating actions, validation, canonical markdown serialization, atomic file writes, and Run now
- `src/html.ts` — layout and escaping helpers

## Local validation

Run `pnpm validate:web` from the repo root for Playwright smoke coverage. It starts the web server locally, checks the dashboard, automations page, and runs page, and retains screenshots/traces only on failure.

## Safety constraints

- Files remain the source of truth; the web UI is only a convenience layer over local/gitignored `automations/` and `skills/` instance files.
- Names are restricted to lowercase letters, numbers, and hyphens to prevent path traversal and stay compatible with runner/cron scripts.
- Automations validate required skill, schedule, prompt, and optional model before writing.
- Skills are edited as raw markdown and delete is blocked while any automation references the skill.
- Mutations use POST with redirect-after-post on success.

## Binding

Defaults:

```txt
HOST=127.0.0.1
PORT=3000
```

Use `HOST=0.0.0.0` only behind a trusted proxy/auth layer such as Coolify, Caddy, Tailscale, or SSH tunnel.
