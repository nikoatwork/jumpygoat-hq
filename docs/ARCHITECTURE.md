# jumpyGoatHq architecture

jumpyGoatHq is a personal runner for scheduled/manual Pi agents.

Strategic frame: jumpyGoatHq should stay the smallest useful open-source Hermes/OpenClaw-like agent operations layer. Keep strong primitives, limited features, and clear extension seams; do not broaden into a workflow builder or feature clone.

```txt
web UI / jumpyGoatHQ CLI -> domain API/service -> markdown source files + SQLite + cron evidence/setup
                                                |
automation.md or ready task.md -----------------+-> invocation -> agent AGENT.md (+ context/*.md) -> runner/dispatcher -> gated Pi connector extension -> pi --mode json -> SQLite run row
```

The web UI, future CLI, and any JSON API must be adapters over the same domain service layer. They should not each reimplement file paths, markdown serialization, validation, run launch behavior, or cron parsing.

## Concepts

jumpyGoatHq keeps the product model intentionally small:

| Boundary | Owns | Does not own |
|---|---|---|
| **Agent bundle** | Identity, instructions, scoped context, model defaults, capability policy, and future explicit resources/memory/procedures. | Secrets, external service schemas, scheduled prompts, task queue state, or run history. |
| **Connector/tool** | Governed external capability: credentials, provider schemas, side-effect policy, Pi-safe tool names, bounded results, and connector audit records. | Agent persona, scheduling, or hidden agent-local capability code. |
| **Artifact** | A file produced or selected during a run and exposed through a governed reference, such as an R2 signed URL. | A destination-specific Dropbox/Drive/Notion object as the product primitive. |
| **Automation/task** | Invocation source: prompt, schedule/status, assignee/agent reference, and run-specific non-secret overrides. | Long-lived persona, service credentials, or persisted run transcript. |
| **Run** | Immutable/auditable execution record: source, agent, resolved model, trace/output/error, connector actions, timing, and usage when Pi reports it. | Source-of-truth authoring state for agents, automations, boards, or tasks. |

### Agent

A reusable, directory-backed Pi runtime bundle with a required `AGENT.md` entrypoint:

```text
workspace/agents/<name>/AGENT.md
workspace/agents/<name>/context/*.md
$JUMPYGOATHQ_HOME/agents/<name>/AGENT.md
```

`AGENT.md` frontmatter defines display metadata, model defaults, and capability policy such as `name`, `description`, optional `model`, `allowedIntents`, and connector defaults. `model` may be a direct Pi selector or an instance semantic profile key. Optional `context/*.md` files are loaded alphabetically and appended to the generated Pi instruction file for each run.

Today jumpyGoatHq only has a runtime loading contract for `AGENT.md` plus ordered `context/*.md`. First-class now:

- `AGENT.md` — required entrypoint, identity/instructions/policy/defaults.
- `context/*.md` — optional scoped markdown loaded alphabetically by filename and appended to the generated run instruction file.

Reserved agent-local directories may exist for author organization but are **not loaded or executed** until a future jumpyGoatHq contract says otherwise:

- `references/` — future detailed reference material, likely loaded on demand or by explicit include rules.
- `templates/` — future reusable output/input templates.
- `assets/` — future binary/static assets referenced by documented paths.
- `procedures/` — future reusable operational procedures distinct from connector tools.
- `scripts/` — future helper scripts; execution must be explicitly gated and auditable.
- `memory/` — future bounded curated memory/state, frozen at run start and updated only through an explicit domain service/tool.

Future loaded resources should have deterministic naming and ordering: lowercase safe names, markdown-first where possible, alphabetical ordering, bounded size, and explicit references in generated run instructions. Mutable memory should live in the agent folder only for curated per-agent memory; project/user-wide memory should use documented project files or a domain data store rather than hidden workspace writes.

Agents are the user-facing primitive. Pi's CLI still calls the generated instruction file a `--skill`, but jumpyGoatHq treats that as an adapter detail, not a separate product concept. The runner disables raw Pi resource discovery for jumpyGoatHq runs so global/project Pi resources do not silently change scheduled/task behavior.

### Automation

A reusable scheduled or manual prompt source for one agent:

```text
workspace/automations/<name>.md
$JUMPYGOATHQ_HOME/automations/<name>.md
```

Example:

```yaml
---
agent: your-agent
schedule: manual
model: gpt-5.5 # optional run override
---

Prompt for this run.
```

Automations are edited as files. The filename is the automation id. Active automation files are local/personal by default and gitignored in the public template.

### Connectors

Connectors are jumpyGoatHq adapters that expose external services to Pi as run-scoped tools. Agents may become richer bundles of instructions, context, resources, helper scripts, and memory, but they do not gain governed external capabilities by bundling arbitrary service code. External tools come through explicit capability policy and connector config.

A connector tool is exposed only when both gates pass:

1. the agent frontmatter `allowedIntents` includes the provider-neutral intent; and
2. the agent default config or automation/task override enables that intent/provider for the run.

Supported intents/tools: `web.search` → `web_search`, `web.scrape` → `web_scrape`, `web.crawl` → `web_crawl`, `notify.email` → `notify_email`, `mail.send` → `mail_send`, `mail.list` → `mail_list`, `script.run` → `script_run`, `artifact.upload` → `artifact_upload`, and `actor.run` → `apify_run_actor`.

Example agent capability policy:

```yaml
allowedIntents:
  - web.search
  - notify.email
  - mail.send
  - mail.list
  - artifact.upload
  - actor.run
web:
  search:
    enabled: true
    connector: firecrawl
notify:
  email:
    enabled: true
    connector: resend
mail:
  send:
    enabled: true
    connector: agentmail
    inboxId: agent@agentmail.to
  list:
    enabled: true
    connector: agentmail
    inboxId: agent@agentmail.to
    limit: 10
artifacts:
  upload:
    enabled: true
    connector: r2
    expiresInSeconds: 604800
actors:
  run:
    enabled: true
    connector: apify
    allow:
      - apidojo/tweet-scraper
    actor: apidojo/tweet-scraper
    maxOutputItems: 25
```

Apify is intentionally a generic but allowlisted actor connector: one shared Apify credential (`APIFY_API_TOKEN`, or `APIFY_API_KEY` as a local compatibility alias) can run many actor types over time, but the agent's `actors.run.allow` list is the permission source of truth. Automations may choose an allowlisted actor and provide data-only input defaults for scheduled runs; Pi tool calls may merge JSON input overrides over those defaults. The tool returns bounded default dataset previews and metadata, not full unbounded datasets.

The runner resolves an effective connector plan and passes a static Pi extension for enabled/allowed tools only. Pi can call those tools during the run. Secrets stay in environment variables. New providers, such as a future Notion connector, should follow the same pattern: add a provider-neutral intent, map it to one or more Pi-safe tool names, require agent capability plus run config, and keep provider credentials out of markdown files.

This keeps the boundary clean: agent-local resources can improve context, memory, formatting, or deterministic helper behavior; connectors own organization/instance service integrations, credentials, side-effect policy, tool schemas, and audit records.

Artifact upload is intentionally modeled as an artifact primitive backed by the R2 connector: a run file becomes `runs/<runId>/<safe-filename>` in private R2 storage, and the agent receives a time-limited presigned URL it can pass to email, webhook, Slack, Notion, or any later action. The artifact is the product-level concept; Cloudflare R2 is the first connector implementation.

Legacy post-run fenced `jumpygoathq-action` email blocks remain temporarily for compatibility, but in-run Pi tools are the default connector architecture.

### Invocation

An internal normalized Pi execution spec created from either an automation or a ready task. An invocation contains source identity, agent, prompt, optional model override, connector overrides, schedule/status label, and workspace key. This keeps the backend runner path shared without merging user-facing concepts. Automation and task invocations use the same agent bundle semantics.

### Board and task queue

Boards group agent-assigned one-off markdown tasks:

```text
workspace/boards/<board>/BOARD.md
workspace/boards/<board>/tasks/<task-id>.md
$JUMPYGOATHQ_HOME/boards/<board>/BOARD.md
$JUMPYGOATHQ_HOME/boards/<board>/tasks/<task-id>.md
```

Task statuses are `not-yet`, `ready`, `working-on-it`, and `done`. `pnpm dispatch:tasks` is the heartbeat dispatcher: an explicit instance cron can run it periodically (default setup is hourly with `--limit=1`), it scans source-of-truth task markdown for `ready` tasks with a valid `assignee`, claims one task by moving it to `working-on-it`, creates a task invocation, runs Pi with board/task context and the assignee agent, writes a normal run row with `source_type = task` plus legacy-compatible `project`/`task_id` run metadata, then moves success to `done` or failure to `not-yet` with a dispatch note. The heartbeat job is not tied to an operator agent; each task's `assignee` selects the runtime agent. The run DB is audit/history, not the open-task queue.

Task heartbeat cron is separate from per-automation cron. `pnpm install:task-cron` writes an idempotent `jumpygoathq:task-heartbeat` crontab block whose command runs from the repo root, exports the same `HOME`/`PATH`/`JUMPYGOATHQ_*` environment as automation cron, and logs to `jumpyGoatHqHome()/data/cron-task-heartbeat.log`. `pnpm list:task-cron`, `pnpm uninstall:task-cron`, and the general `pnpm list:cron` surface installed/missing/malformed status. Cadence and limit are setup-time CLI/env choices (`--schedule`, `--limit`, `JUMPYGOATHQ_TASK_HEARTBEAT_CRON`, `JUMPYGOATHQ_TASK_DISPATCH_LIMIT`), not persisted in `settings.yml`.

### Workspace

Per-invocation Pi working directory:

```text
workspace/workspaces/<automation-or-task-workspace-key>/
$JUMPYGOATHQ_HOME/workspaces/<automation-or-task-workspace-key>/
```

Automation invocations use the automation id as the workspace key; task invocations use a task-derived key. The runner starts Pi with this directory as `cwd`. Runtime data only; gitignored.

### Instance settings

Operator-specific settings live outside committed source at:

```text
workspace/settings.yml
$JUMPYGOATHQ_HOME/settings.yml
```

The first schema covers semantic model profiles only:

```yaml
defaultModelProfile: fast
modelProfiles:
  fast: "provider:fast-model"
  super-smart:
    selector: "provider:smart-model"
    label: "Super smart"
```

jumpyGoatHq validates profile keys/selector strings and resolves profile keys to concrete Pi `--model` selectors. Unknown model strings pass through as direct Pi selectors with audit metadata rather than failing locally. Secrets, API keys, provider auth, and custom providers remain Pi/environment concerns and do not belong in settings.

### Run DB

One execution of one invocation is stored in the shared SQLite DB:

```text
workspace/data/jumpygoat-hq.sqlite
$JUMPYGOATHQ_HOME/data/jumpygoat-hq.sqlite
```

The `runs` table stores legacy-compatible `automation`, explicit `source_type`/`source_id`, agent, optional `project`/`task_id`, requested/resolved model/profile audit fields, status/timing, output text, trace text, error text, connector action JSON, and nullable best-effort Pi-emitted usage/cost aggregates.

## Unified domain API and clients

To let the raw HTML web UI and `jumpygoathq` CLI perform the same CRUD operations, jumpyGoatHq uses one local domain API/service boundary instead of treating web route handlers as the mutation layer.

Implemented package split:

- `packages/core` — source-of-truth readers/writers and validators for agents, automations, boards, tasks, settings, runs, and cron status/setup. This package owns safe names, canonical markdown/YAML serialization, atomic file writes, delete guards, run-now dispatch, and crontab block parsing/install/uninstall wrappers.
- `packages/web/src/api.ts` — HTTP JSON adapter over `packages/core`. It exposes stable DTOs and structured errors, but must not contain product rules that are not also enforced by `packages/core`. Split to a standalone `packages/api` only if deployment needs it later.
- `packages/web` — HTML adapter. Route handlers parse form input, call `packages/core`, then render/redirect. HTML routes stay POST + redirect-after-post.
- `packages/cli` — command adapter with a `jumpygoathq` bin. Default local mode calls `packages/core` in-process for speed and offline use; `--api-url`, `JUMPYGOATHQ_API_URL`, or named instance profiles call the same JSON API for remote/self-hosted deployments.
- `packages/shared` — pure DTO/schema/path helpers used by core/web/runner. Avoid adding new filesystem side effects here unless intentionally reorganized.

The API shape should stay resource-oriented and mirror the product primitives, not the current HTML route names:

```txt
GET    /api/agents
POST   /api/agents
GET    /api/agents/:name
PUT    /api/agents/:name
DELETE /api/agents/:name

GET    /api/automations
POST   /api/automations
GET    /api/automations/:name
PUT    /api/automations/:name
DELETE /api/automations/:name
POST   /api/automations/:name/runs

GET    /api/boards
POST   /api/boards
GET    /api/boards/:board
PUT    /api/boards/:board
DELETE /api/boards/:board
GET    /api/tasks?board=:board&status=:status
POST   /api/tasks
GET    /api/boards/:board/tasks/:task
PUT    /api/boards/:board/tasks/:task
PATCH  /api/boards/:board/tasks/:task/status
DELETE /api/boards/:board/tasks/:task

GET    /api/runs
GET    /api/runs/:id
GET    /api/settings
PUT    /api/settings
GET    /api/cron
PUT    /api/cron/automations { name }
DELETE /api/cron/automations { name }
PUT    /api/cron/automations/:name
DELETE /api/cron/automations/:name
PUT    /api/cron/task-heartbeat
DELETE /api/cron/task-heartbeat
```

Cron remains an installation/deployment concern, not a separate authoring source of truth: automation schedules live in automation markdown, task heartbeat cadence is setup/env choice, and crontab blocks are evidence plus setup targets. Exposing cron through the CLI/API is acceptable for operator setup (`install`, `uninstall`, `status`) but should not create a second schedule model.

DTOs should include enough metadata for safe clients: `name`/`id`, parsed fields, raw markdown where raw editing is intentionally supported, warnings, `updatedAt`/mtime, and an `etag` or revision token. Mutations should support optimistic concurrency (`If-Match` or explicit revision) before overwriting files. Errors should be deterministic JSON (`code`, `message`, `fields`) so the CLI can print useful failures and the web UI can map the same failures back into forms.

The JSON API binds with the same web server default of `127.0.0.1`. Set `JUMPYGOATHQ_API_TOKEN` before remote use; `/api/...` then requires `Authorization: Bearer <token>` or `x-api-token: <token>`. Keep the server behind HTTPS/proxy, Tailscale, or an SSH tunnel before binding broadly. Secrets/provider env vars are not returned by API DTOs. Side-effecting endpoints such as run-now and cron install/uninstall emit `[api:audit]` lines to server stdout.

## Runtime flow

1. Cron or user runs `pnpm runner <automation>`.
2. Runner parses `jumpyGoatHqHome()/automations/<automation>.md` and converts it to an automation invocation. The task heartbeat instead converts a claimed ready task to a task invocation.
3. Runner resolves `jumpyGoatHqHome()/agents/<agent>/AGENT.md` plus alphabetical `context/*.md`.
4. Runner resolves effective requested model in order: invocation override, agent default, instance `defaultModelProfile`, then Pi default.
5. Runner converts a matching semantic profile key from `settings.yml` to a concrete Pi selector; unknown strings pass through as direct selectors with a warning in run metadata. Runner also resolves the connector plan from agent defaults plus invocation overrides.
6. Runner writes a generated agent instruction file under the invocation workspace and starts Pi:

   ```bash
   pi --mode json --no-session --no-skills --no-context-files --skill <generated-agent-file> [--extension <connector-extension>] [--model <model>] <prompt>
   ```

   `--skill` is Pi's CLI term for the generated instruction file. `--no-skills` keeps discovered Pi capability bundles out while still allowing the explicit generated file, and `--no-context-files` prevents parent `AGENTS.md`/`CLAUDE.md` files from silently entering scheduled/task runs. jumpyGoatHq's domain model remains automation/task → invocation → agent → run. No custom Pi `--system-prompt` is used by default; jumpyGoatHq run framing lives in the generated agent instruction file to avoid duplicating context.

7. Pi runs in `jumpyGoatHqHome()/workspaces/<invocation-workspace-key>/`.
8. Runner captures Pi JSON events into readable output/trace fields, normalizes any Pi-emitted `message.usage` details without estimating missing values, and updates the run row.

## Web viewer

Server-rendered HTML adapter over the unified domain service/API. It reads automations, agents, boards/tasks, task heartbeat status, crontab, and SQLite through shared domain readers instead of owning product rules in route handlers. The same server exposes `/api/...` JSON routes for CLI/remote clients. Default bind is `127.0.0.1:3000`.

Routes:

- `/` — overview/dashboard summary, including task heartbeat cron status
- `/automations`, `/automations/new`, `/automations/:name`, `/automations/:name/edit`
- `/schedule` — read-only 7-day agenda/calendar view of scheduled automations, cron install status, and orphan/malformed jumpyGoatHq cron block warnings
- `/agents`, `/agents/new`, `/agents/:name`, `/agents/:name/edit`
- `/boards`, `/boards/new`, `/boards/:board`, `/boards/:board/edit`
- `/tasks`, `/tasks/new`, `/boards/:board/tasks/:task`, `/boards/:board/tasks/:task/edit` — includes task heartbeat install/status notice
- `/runs`, `/runs/:id`
- `/settings` — edit instance-local `settings.yml`, view model profiles, and review usage grouped by model/profile

Mutations remain intentionally file-native POST actions in the HTML surface: automation create/update/delete, cautious raw agent create/update/delete, task/board file edits, and “Run now.” The route handlers should delegate to the same domain operations used by the CLI/API. The schedule page does not need to mutate cron; automation markdown is the schedule source of truth and crontab blocks are status/evidence only. If cron setup is exposed in web later, it should call the same explicit cron install/uninstall domain operations as the CLI rather than writing crontab directly.

## Validation

Coding agents can validate work from the repo root:

```bash
pnpm validate:web
pnpm validate:backend
pnpm validate
```

The backend smoke creates a temporary gitignored smoke agent/automation if needed, writes and verifies one SQLite `runs` row, then prints output/error/trace tails in-session for inspection. It does not run all automations or mutate cron.

## Environment and auth

Preferred personal setup: authenticate Pi once as the same Unix user that runs jumpyGoatHq.

`.env.local` is optional and gitignored. Use it for provider env vars or overrides such as `JUMPYGOATHQ_HOME`, `JUMPYGOATHQ_DB_PATH`, or `JUMPYGOATHQ_API_TOKEN`; `.env.example` is the commitable template. When unset, `jumpyGoatHqHome()` is `repoRoot()/workspace`. When set, mutable state lives directly under `JUMPYGOATHQ_HOME`. Relative `JUMPYGOATHQ_DB_PATH` values resolve under `jumpyGoatHqHome()`.

CLI development install from this repo:

```bash
pnpm --filter @jumpygoat-hq/cli build
pnpm --filter @jumpygoat-hq/cli link --global
```

CLI local mode uses local core/files. Remote mode uses the JSON API:

```bash
jumpygoathq agents list
jumpygoathq instances add home --api-url https://hq.example.com --token "$JUMPYGOATHQ_API_TOKEN"
jumpygoathq --instance home runs list --limit 10
```

## Safety constraints

- Pi remains the agent harness; no custom LLM/tool loop.
- Browser editing is intentionally limited to file-native automation CRUD and cautious raw `AGENT.md` editing.
- Runtime/personal state is gitignored by default.
- Web auth for HTML pages is deferred; bind locally or put behind trusted proxy/auth.
- JSON API remote use should set `JUMPYGOATHQ_API_TOKEN` and run behind HTTPS/proxy, Tailscale, or an SSH tunnel.
