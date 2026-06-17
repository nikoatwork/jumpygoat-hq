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

The web UI has a deliberately small, server-rendered design system built on [`@sakun/system.css`](https://github.com/sakofchit/system.css):

- Do not add React, Tailwind, CSS-in-JS, component libraries, bundlers, client-side routing, or a build step for styling. `@sakun/system.css` is the only frontend styling dependency.
- Load System.css from the local npm package via `/system.css`; keep `public/styles.css` as a thin adapter for app layout, accessibility targets, responsive tables, kanban, and route-specific glue.
- Keep third-party icons tiny and local: vendor only individual SVGs under `public/icons/` and serve them from `/icons/<set>/<name>.svg`; do not add full icon-set packages or CDN dependencies.
- Use System.css primitives where they fit (`.window`, `.title-bar`, `.separator`, `.window-pane`, `.standard-dialog`, `.btn`-style controls) and keep app markup semantic. Prefer spacious document-like pages, Finder-style navigation, folder/window card treatments, and classic Mac affordances over dense admin-console panels.
- Use shared helpers from `src/html.ts` for repeated patterns: `appIcon`, `iconLabel`, `pageHeader`, `section`, `pageGrid`, `panel`, `formPanel`, `card`, `folderCard`, `toolbar`, `inlineActions`, `actionLink`, `notice`, `badge`, `emptyState`, `table`, and `metaTable`.
- UIM is the primary UI icon set. Route code should request semantic icon names through `appIcon()`/`iconLabel()`; Simple Icons are reserved for provider/brand marks.
- Prefer canonical app classes for route markup: `.app-shell`, `.sidebar`, `.sidebar-nav`, `.nav-link`, `.page-header`, `.page-actions`, `.section`, `.page-grid`, `.panel`, `.card`, `.folder-card`, `.form-panel`, `.toolbar`, `.inline-actions`, `.empty-state`, `.notice`, `.badge`, `.icon-label`, `.app-icon`, `.form-stack`, `.form-grid`, `.table-wrap`, and `.meta-table`.
- Keep true page-specific layout CSS page-specific. Current examples include `.kanban-*`, `.agenda-*`, `.trace-*`, and `.schedule-*` rules.

Common route patterns:

```ts
pageHeader("Automations", { actions: actionLink("/automations/new", "Create automation", "create") });
pageGrid(card("Ready queue", "<p>Tasks waiting for agents.</p>", { icon: "tasks" }));
table(["Name", "Action"], rows, { empty: "No automations found." });
notice("created: daily-report", "success");
badge("installed", "installed");
```

Use `form-stack` for simple vertical forms and `form-grid` for compact field groups. Use `raw(...)` only for intentional trusted HTML fragments from route code; helper text values escape by default.

## UX acceptance checklist

Before shipping web UI changes:

- Interactive controls that behave like actions have at least a 44px target height.
- Every input, select, and textarea has a visible label or an explicit accessible label.
- Destructive actions include a named confirmation field and predictable focus order.
- Status is not communicated by color alone; use badge text or a visible marker plus text.
- Tables either use the shared `table`/`metaTable` helpers or provide a narrow-screen alternative.
- Kanban remains usable without drag/drop and without JavaScript-only status changes.
- Empty states teach the next useful action.
- Motion respects `prefers-reduced-motion`.
- Visual tone stays close to monochrome classic Mac/System.css; status is carried by text, symbols, and labels rather than color alone.

Reconsider a React/client-heavy migration only if the product needs a genuinely interactive operator console that cannot stay clear with server-rendered HTML plus small progressive-enhancement scripts.

## Local validation

Run `pnpm check:design` for the lightweight design-system guardrails. Run `pnpm validate:web` from the repo root for web build + Playwright smoke coverage. It starts the web server locally, checks the primary pages, and retains screenshots/traces only on failure.

For broad redesign work, capture one temporary Playwright screenshot per page or route family at desktop width, plus a mobile screenshot for `/`; inspect for overflow/density/obvious rendering defects; then delete approved screenshots before finishing the task.

## Safety constraints

- Files remain the source of truth; the web UI is only a convenience layer over gitignored instance files under `jumpyGoatHqHome()` (`workspace/` locally by default, or `JUMPYGOATHQ_HOME` when set).
- Names are restricted to lowercase letters, numbers, and hyphens to prevent path traversal and stay compatible with runner/cron scripts.
- Automations validate required agent, schedule, prompt, and optional model before writing. Optional model values can be semantic profile keys from `/settings` or direct Pi selectors.
- `/schedule` is read-only: automation markdown schedules are the source of truth; installed automation crontab blocks are displayed only as status/evidence, including orphan or malformed blocks. The separate task heartbeat cron status appears on Overview and Tasks.
- Agents are edited as raw markdown and delete is blocked while any automation references the agent. The UI intentionally exposes only `AGENT.md`; optional `context/*.md` files and reserved resource directories remain file-authored until richer contracts exist.
- Boards and tasks are markdown source of truth under `jumpyGoatHqHome()/boards`; kanban drag/drop posts to the same status route as non-JS buttons.
- `/settings` writes only `jumpyGoatHqHome()/settings.yml`, validates before replacing the previous file, and must not collect secrets/API keys; Pi/provider auth remains outside the web UI.
- Mutations use POST with redirect-after-post on success.

## JSON API

The same server exposes a thin JSON adapter under `/api/...` for CLI/remote clients. It delegates product rules to `@jumpygoat-hq/core` and returns deterministic errors:

```json
{ "code": "VALIDATION_FAILED", "message": "...", "fields": [{ "field": "name", "message": "..." }] }
```

Set `JUMPYGOATHQ_API_TOKEN` to require `Authorization: Bearer <token>` or `x-api-token: <token>` on all `/api/...` requests. Leave it unset only for localhost-only development.

CLI examples:

```bash
# Local API server; the CLI defaults to http://127.0.0.1:3000
pnpm dev:web
jumpygoathq agents list

# HTTPS/proxy/Tailscale endpoint saved as a named API target
jumpygoathq instances add home --api-url https://hq.example.com --token "$JUMPYGOATHQ_API_TOKEN"
jumpygoathq --instance home agents list

# SSH tunnel to a server still bound to localhost
ssh -L 3000:127.0.0.1:3000 user@vps
jumpygoathq instances add tunnel --api-url http://127.0.0.1:3000 --token "$JUMPYGOATHQ_API_TOKEN"
```

### Agent + automation setup API

Common three-call flow:

```bash
# 1. Create or update the agent bundle.
curl -sS -X PUT "$HQ/api/agents/news-reporter" \
  -H "Authorization: Bearer $JUMPYGOATHQ_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d @- <<'JSON'
{
  "content": "---\nname: news-reporter\ndescription: Finds notable product news and emails a concise digest.\nallowedIntents: [web.search, web.scrape, notify.email]\n---\n\n## Identity\n\nReport concise, sourced product news.\n"
}
JSON

# 2. Create or update the automation, preserving connector frontmatter.
curl -sS -X PUT "$HQ/api/automations/daily-product-news" \
  -H "Authorization: Bearer $JUMPYGOATHQ_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d @- <<'JSON'
{
  "agent": "news-reporter",
  "schedule": "0 8 * * *",
  "prompt": "Search for notable product/AI developer-tool news from the last day and email a concise digest.",
  "web": {
    "search": { "enabled": true, "connector": "firecrawl", "limit": 5 },
    "scrape": { "enabled": true, "connector": "firecrawl", "maxOutputChars": 12000 }
  },
  "notify": {
    "email": {
      "enabled": true,
      "connector": "resend",
      "to": "ops@example.com",
      "from": "jumpyGoatHq <agent@example.com>",
      "subjectPrefix": "[daily-news]"
    }
  }
}
JSON

# 3. Run once now.
curl -sS -X POST "$HQ/api/automations/daily-product-news/runs" \
  -H "Authorization: Bearer $JUMPYGOATHQ_API_TOKEN"
```

`PUT /api/agents/:name` and `PUT /api/automations/:name` are idempotent upserts. Their responses include `created`, `updated`, `path`, `etag`, and the resource DTO. Validation failures return the deterministic error shape above.

Script-enabled agents use the same API. Upload `AGENT.md` content that includes `allowedIntents: [script.run]` and `scripts.run` config, then place reviewed `.ts`/`.tsx` files under that agent's `scripts/` folder on the server/workspace. Automation upserts may narrow or override `scripts.run.allow`, `network`, `write`, `timeoutMs`, and `maxOutputChars`; never send secrets in markdown.

One-shot setup combines the same operations:

```bash
curl -sS -X POST "$HQ/api/setup/automation" \
  -H "Authorization: Bearer $JUMPYGOATHQ_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d @- <<'JSON'
{
  "agent": {
    "name": "news-reporter",
    "content": "---\nname: news-reporter\ndescription: Finds notable product news and emails a concise digest.\nallowedIntents: [web.search, web.scrape, notify.email]\n---\n\n## Identity\n\nReport concise, sourced product news.\n"
  },
  "automation": {
    "name": "daily-product-news",
    "schedule": "0 8 * * *",
    "prompt": "Search for notable product/AI developer-tool news from the last day and email a concise digest.",
    "web": {
      "search": { "enabled": true, "connector": "firecrawl", "limit": 5 },
      "scrape": { "enabled": true, "connector": "firecrawl", "maxOutputChars": 12000 }
    },
    "notify": {
      "email": {
        "enabled": true,
        "connector": "resend",
        "to": "ops@example.com",
        "from": "jumpyGoatHq <agent@example.com>",
        "subjectPrefix": "[daily-news]"
      }
    }
  },
  "installCron": true,
  "runNow": true
}
JSON
```

The setup response is `{ agent, automation, cron, run, warnings }`. Agent and automation writes fail normally on validation errors. Cron install and run-now failures are returned as warnings so callers can inspect the partially completed setup.

Status inspection:

```bash
curl -sS "$HQ/api/automations/daily-product-news/status?limit=5" \
  -H "Authorization: Bearer $JUMPYGOATHQ_API_TOKEN"
```

`GET /api/automations/:name/status` returns automation metadata, installed-cron evidence, connector summaries, recent run summaries, and warnings. Large run trace text is intentionally omitted; use `GET /api/runs/:id` for full run details.

Cron helpers:

```bash
curl -sS -X PUT "$HQ/api/cron/automations/daily-product-news" -H "Authorization: Bearer $JUMPYGOATHQ_API_TOKEN"
curl -sS -X DELETE "$HQ/api/cron/automations/daily-product-news" -H "Authorization: Bearer $JUMPYGOATHQ_API_TOKEN"
curl -sS "$HQ/api/cron" -H "Authorization: Bearer $JUMPYGOATHQ_API_TOKEN"
```

Side-effecting API calls such as run-now, setup with `installCron`/`runNow`, and cron install/uninstall emit an `[api:audit]` line to server stdout.

### API troubleshooting

- **CLI/API reachability:** if local calls fail, start `pnpm dev:web`/`pnpm web` and verify `curl http://127.0.0.1:3000/api`. If remote calls fail, verify the server is reachable from the client (`curl $HQ/api`), the server is bound to the expected interface, and `JUMPYGOATHQ_API_TOKEN` matches the CLI/API token. Prefer a named CLI instance for repeat use.
- **Cron PATH:** installed cron blocks export the current `HOME`, `PATH`, `JUMPYGOATHQ_HOME`, and `JUMPYGOATHQ_DB_PATH` where present. If cron runs fail, inspect `jumpyGoatHqHome()/data/cron-<automation>.log` and ensure `pnpm` is on the PATH captured during install.
- **Email `from`:** Resend notifications require `notify.email.from` or `JUMPYGOATHQ_NOTIFY_EMAIL_FROM`; the sender must be valid for the configured Resend account/domain. `notify.email.to` can be supplied in automation frontmatter or `JUMPYGOATHQ_NOTIFY_EMAIL_TO`.
- **AgentMail inbox:** AgentMail send/list tools require `AGENTMAIL_API_KEY` plus `mail.send.inboxId`, `mail.list.inboxId`, or `AGENTMAIL_INBOX_ID`. Use `mail.send`/`mail.list` in `allowedIntents` and `connector: agentmail` in config.
- **Local scripts:** `script.run` requires `tsx` on the server PATH and an allowlisted script under the agent folder's `scripts/` directory. Run `pnpm run doctor` on the server if `script_run` fails before starting.

## Binding

Defaults:

```txt
HOST=127.0.0.1
PORT=3000
```

Use `HOST=0.0.0.0` only behind a trusted proxy/auth layer such as Coolify, Caddy, Tailscale, or SSH tunnel. Set `JUMPYGOATHQ_API_TOKEN` before using the JSON API remotely.
