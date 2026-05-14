# agenthq architecture

agenthq is a personal runner for scheduled/manual Pi agents.

Strategic frame: agenthq should stay the smallest useful open-source Hermes/OpenClaw-like agent operations layer. Keep strong primitives, limited features, and clear extension seams; do not broaden into a workflow builder or feature clone.

```txt
automation.md or ready task.md -> invocation -> agent AGENT.md (+ context/*.md) -> runner/dispatcher -> gated Pi connector extension -> pi --mode json -> SQLite run row -> raw HTML viewer
```

## Concepts

AgentHQ keeps the product model intentionally small:

| Boundary | Owns | Does not own |
|---|---|---|
| **Agent bundle** | Identity, instructions, scoped context, model defaults, capability policy, and future explicit resources/memory/procedures. | Secrets, external service schemas, scheduled prompts, task queue state, or run history. |
| **Connector/tool** | Governed external capability: credentials, provider schemas, side-effect policy, Pi-safe tool names, bounded results, and connector audit records. | Agent persona, scheduling, or hidden agent-local capability code. |
| **Automation/task** | Invocation source: prompt, schedule/status, assignee/agent reference, and run-specific non-secret overrides. | Long-lived persona, service credentials, or persisted run transcript. |
| **Run** | Immutable/auditable execution record: source, agent, resolved model, trace/output/error, connector actions, timing, and usage when Pi reports it. | Source-of-truth authoring state for agents, automations, projects, or tasks. |

### Agent

A reusable, directory-backed Pi runtime bundle with a required `AGENT.md` entrypoint:

```text
workspace/agents/<name>/AGENT.md
workspace/agents/<name>/context/*.md
$AGENTHQ_HOME/agents/<name>/AGENT.md
```

`AGENT.md` frontmatter defines display metadata, model defaults, and capability policy such as `name`, `description`, optional `model`, `allowedIntents`, and connector defaults. `model` may be a direct Pi selector or an instance semantic profile key. Optional `context/*.md` files are loaded alphabetically and appended to the generated Pi instruction file for each run.

Today AgentHQ only has a runtime loading contract for `AGENT.md` plus ordered `context/*.md`. First-class now:

- `AGENT.md` — required entrypoint, identity/instructions/policy/defaults.
- `context/*.md` — optional scoped markdown loaded alphabetically by filename and appended to the generated run instruction file.

Reserved agent-local directories may exist for author organization but are **not loaded or executed** until a future AgentHQ contract says otherwise:

- `references/` — future detailed reference material, likely loaded on demand or by explicit include rules.
- `templates/` — future reusable output/input templates.
- `assets/` — future binary/static assets referenced by documented paths.
- `procedures/` — future reusable operational procedures distinct from connector tools.
- `scripts/` — future helper scripts; execution must be explicitly gated and auditable.
- `memory/` — future bounded curated memory/state, frozen at run start and updated only through an explicit domain service/tool.

Future loaded resources should have deterministic naming and ordering: lowercase safe names, markdown-first where possible, alphabetical ordering, bounded size, and explicit references in generated run instructions. Mutable memory should live in the agent folder only for curated per-agent memory; project/user-wide memory should use documented project files or a domain data store rather than hidden workspace writes.

Agents are the user-facing primitive. Pi's CLI still calls the generated instruction file a `--skill`, but AgentHQ treats that as an adapter detail, not a separate product concept. The runner disables raw Pi resource discovery for AgentHQ runs so global/project Pi resources do not silently change scheduled/task behavior.

### Automation

A reusable scheduled or manual prompt source for one agent:

```text
workspace/automations/<name>.md
$AGENTHQ_HOME/automations/<name>.md
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

Connectors are AgentHQ adapters that expose external services to Pi as run-scoped tools. Agents may become richer bundles of instructions, context, resources, helper scripts, and memory, but they do not gain governed external capabilities by bundling arbitrary service code. External tools come through explicit capability policy and connector config.

A connector tool is exposed only when both gates pass:

1. the agent frontmatter `allowedIntents` includes the provider-neutral intent; and
2. the agent default config or automation/task override enables that intent/provider for the run.

Supported intents/tools: `web.search` → `web_search`, `web.scrape` → `web_scrape`, `web.crawl` → `web_crawl`, and `notify.email` → `notify_email`.

Example agent capability policy:

```yaml
allowedIntents:
  - web.search
  - notify.email
web:
  search:
    enabled: true
    connector: firecrawl
notify:
  email:
    enabled: true
    connector: resend
```

The runner resolves an effective connector plan and passes a static Pi extension for enabled/allowed tools only. Pi can call those tools during the run. Secrets stay in environment variables. New providers, such as a future Notion connector, should follow the same pattern: add a provider-neutral intent, map it to one or more Pi-safe tool names, require agent capability plus run config, and keep provider credentials out of markdown files.

This keeps the boundary clean: agent-local resources can improve context, memory, formatting, or deterministic helper behavior; connectors own organization/instance service integrations, credentials, side-effect policy, tool schemas, and audit records.

Legacy post-run fenced `agenthq-action` email blocks remain temporarily for compatibility, but in-run Pi tools are the default connector architecture.

### Invocation

An internal normalized Pi execution spec created from either an automation or a ready task. An invocation contains source identity, agent, prompt, optional model override, connector overrides, schedule/status label, and workspace key. This keeps the backend runner path shared without merging user-facing concepts. Automation and task invocations use the same agent bundle semantics.

### Project and task queue

Projects group agent-assigned one-off markdown tasks:

```text
workspace/projects/<project>/PROJECT.md
workspace/projects/<project>/tasks/<task-id>.md
$AGENTHQ_HOME/projects/<project>/PROJECT.md
$AGENTHQ_HOME/projects/<project>/tasks/<task-id>.md
```

Task statuses are `backlog`, `ready`, `doing`, `review`, `done`, `blocked`, and `failed`. `pnpm dispatch:tasks` is the heartbeat dispatcher: an instance cron can run it periodically (for example hourly), it scans source-of-truth task markdown for `ready` tasks with a valid `assignee`, claims one task by moving it to `doing`, creates a task invocation, runs Pi with project/task context and the assignee agent, writes a normal run row with `source_type = task` plus `project`/`task_id`, then moves success to `review` or failure to `failed`. The run DB is audit/history, not the open-task queue.

### Workspace

Per-invocation Pi working directory:

```text
workspace/workspaces/<automation-or-task-workspace-key>/
$AGENTHQ_HOME/workspaces/<automation-or-task-workspace-key>/
```

Automation invocations use the automation id as the workspace key; task invocations use a task-derived key. The runner starts Pi with this directory as `cwd`. Runtime data only; gitignored.

### Instance settings

Operator-specific settings live outside committed source at:

```text
workspace/settings.yml
$AGENTHQ_HOME/settings.yml
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

AgentHQ validates profile keys/selector strings and resolves profile keys to concrete Pi `--model` selectors. Unknown model strings pass through as direct Pi selectors with audit metadata rather than failing locally. Secrets, API keys, provider auth, and custom providers remain Pi/environment concerns and do not belong in settings.

### Run DB

One execution of one invocation is stored in the shared SQLite DB:

```text
workspace/data/agenthq.sqlite
$AGENTHQ_HOME/data/agenthq.sqlite
```

The `runs` table stores legacy-compatible `automation`, explicit `source_type`/`source_id`, agent, optional `project`/`task_id`, requested/resolved model/profile audit fields, status/timing, output text, trace text, error text, connector action JSON, and nullable best-effort Pi-emitted usage/cost aggregates.

## Runtime flow

1. Cron or user runs `pnpm runner <automation>`.
2. Runner parses `agenthqHome()/automations/<automation>.md` and converts it to an automation invocation. The task heartbeat instead converts a claimed ready task to a task invocation.
3. Runner resolves `agenthqHome()/agents/<agent>/AGENT.md` plus alphabetical `context/*.md`.
4. Runner resolves effective requested model in order: invocation override, agent default, instance `defaultModelProfile`, then Pi default.
5. Runner converts a matching semantic profile key from `settings.yml` to a concrete Pi selector; unknown strings pass through as direct selectors with a warning in run metadata. Runner also resolves the connector plan from agent defaults plus invocation overrides.
6. Runner writes a generated agent instruction file under the invocation workspace and starts Pi:

   ```bash
   pi --mode json --no-session --no-skills --no-context-files --skill <generated-agent-file> [--extension <connector-extension>] [--model <model>] <prompt>
   ```

   `--skill` is Pi's CLI term for the generated instruction file. `--no-skills` keeps discovered Pi capability bundles out while still allowing the explicit generated file, and `--no-context-files` prevents parent `AGENTS.md`/`CLAUDE.md` files from silently entering scheduled/task runs. AgentHQ's domain model remains automation/task → invocation → agent → run. No custom Pi `--system-prompt` is used by default; AgentHQ run framing lives in the generated agent instruction file to avoid duplicating context.

7. Pi runs in `agenthqHome()/workspaces/<invocation-workspace-key>/`.
8. Runner captures Pi JSON events into readable output/trace fields, normalizes any Pi-emitted `message.usage` details without estimating missing values, and updates the run row.

## Web viewer

Reads automations, agents, projects/tasks, crontab, and SQLite. Default bind is `127.0.0.1:3000`.

Routes:

- `/` — overview/dashboard summary
- `/automations`, `/automations/new`, `/automations/:name`, `/automations/:name/edit`
- `/schedule` — read-only 7-day agenda/calendar view of scheduled automations, cron install status, and orphan/malformed AgentHQ cron block warnings
- `/agents`, `/agents/new`, `/agents/:name`, `/agents/:name/edit`
- `/projects`, `/projects/new`, `/projects/:project`, `/projects/:project/edit`
- `/tasks`, `/tasks/new`, `/projects/:project/tasks/:task`, `/projects/:project/tasks/:task/edit`
- `/runs`, `/runs/:id`
- `/settings` — edit instance-local `settings.yml`, view model profiles, and review usage grouped by model/profile

Mutations are intentionally file-native POST actions: automation create/update/delete, cautious raw agent create/update/delete, and “Run now,” which shells out to `pnpm runner <automation>`. The schedule page does not mutate cron; automation markdown is the schedule source of truth and crontab blocks are status/evidence only.

## Validation

Coding agents can validate work from the repo root:

```bash
pnpm validate:web
pnpm validate:backend
pnpm validate
```

The backend smoke creates a temporary gitignored smoke agent/automation if needed, writes and verifies one SQLite `runs` row, then prints output/error/trace tails in-session for inspection. It does not run all automations or mutate cron.

## Environment and auth

Preferred personal setup: authenticate Pi once as the same Unix user that runs agenthq.

`.env.local` is optional and gitignored. Use it for provider env vars or overrides such as `AGENTHQ_HOME` or `AGENTHQ_DB_PATH`; `.env.example` is the commitable template. When unset, `agenthqHome()` is `repoRoot()/workspace`. When set, mutable state lives directly under `AGENTHQ_HOME`. Relative `AGENTHQ_DB_PATH` values resolve under `agenthqHome()`.

## Safety constraints

- Pi remains the agent harness; no custom LLM/tool loop.
- Browser editing is intentionally limited to file-native automation CRUD and cautious raw `AGENT.md` editing.
- Runtime/personal state is gitignored by default.
- Web auth is deferred; bind locally or put behind trusted proxy/auth.
