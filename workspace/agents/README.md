# workspace/agents

Local active agents live here by default. Set `JUMPYGOATHQ_HOME=/path/to/jumpygoat-hq-home` to use an external workspace; then active agents live in `$JUMPYGOATHQ_HOME/agents/`.

Each agent is an jumpyGoatHq bundle: identity, instructions, scoped context, defaults, and capability policy. Runtime loading is deliberately minimal today:

```text
workspace/agents/<name>/AGENT.md          # required; loaded every run
workspace/agents/<name>/context/*.md      # optional; loaded alphabetically
```

Reserved directories may be used for organization, but jumpyGoatHq does **not** load or execute them yet:

```text
workspace/agents/<name>/references/       # reserved future reference docs
workspace/agents/<name>/templates/        # reserved future templates
workspace/agents/<name>/assets/           # reserved future static assets
workspace/agents/<name>/procedures/       # reserved future reusable procedures
workspace/agents/<name>/scripts/          # reserved future gated helper scripts
workspace/agents/<name>/memory/           # reserved future curated memory/state
```

Do not put secrets in agent folders. External services, side effects, tool schemas, and audit records belong to connectors/tools gated by `allowedIntents` plus run config.

Automations reference agents by name:

```yaml
---
agent: your-agent
schedule: manual
---

Prompt for this run.
```

Tasks also reference agents by name in their `assignee` frontmatter. The task heartbeat cron only runs `pnpm dispatch:tasks`; it does not use or replace a single dispatcher/operator agent.

## AGENT.md format

`AGENT.md` is the bundle entrypoint: a Pi instruction file with YAML frontmatter plus markdown instructions. Use it for identity, operating policy, output expectations, model defaults, and connector capability policy:

```markdown
---
name: your-agent
description: What this agent is responsible for.
model: gpt-5.5 # optional default; automation model overrides this
allowedIntents:
  - web.search
web:
  search:
    enabled: true
    connector: firecrawl
    limit: 5
notify:
  email:
    enabled: false
    connector: resend
---

## Instructions

Tell Pi who this agent is, how it should work, what it should not do, and when it may use connector tools.
```

Supported connector intents are `web.search`, `web.scrape`, `web.crawl`, and `notify.email`. `allowedIntents` is the capability gate. Connector config in `AGENT.md` provides non-secret defaults; automation/task invocation frontmatter may override run-specific non-secret values when needed.

Context files under `context/*.md` are loaded alphabetically by filename and appended to the generated Pi instruction file for each run. Recommended naming: `00-overview.md`, `10-playbook.md`, `20-style.md`. Keep context markdown deterministic and non-secret unless your `JUMPYGOATHQ_HOME` is private.

Future loaded resources must use explicit jumpyGoatHq rules for naming, ordering, size limits, and execution/audit behavior. Until those contracts exist, `references/`, `templates/`, `assets/`, `procedures/`, `scripts/`, and `memory/` are non-loaded authoring space only.

This directory is mutable operator state. Agent directories are gitignored; only this README is committed.
