# workspace/agents

Local active agents live here by default. Set `AGENTHQ_HOME=/path/to/agenthq-home` to use an external workspace; then active agents live in `$AGENTHQ_HOME/agents/`.

Each agent is a directory with an `AGENT.md` file and optional scoped markdown context:

```text
workspace/agents/<name>/AGENT.md
workspace/agents/<name>/context/*.md
```

Automations reference agents by name:

```yaml
---
agent: your-agent
schedule: manual
---

Prompt for this run.
```

## AGENT.md format

`AGENT.md` is a Pi instruction file with YAML frontmatter plus markdown instructions:

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

Tell Pi how this agent should work.
```

Supported connector intents are `web.search`, `web.scrape`, `web.crawl`, and `notify.email`. `allowedIntents` is the capability gate. Connector config in `AGENT.md` provides defaults; automation frontmatter may override run-specific values when needed.

Context files under `context/*.md` are loaded alphabetically and appended to the generated Pi instruction file for each run. Keep context markdown deterministic and non-secret unless your `AGENTHQ_HOME` is private.

This directory is mutable operator state. Agent directories are gitignored; only this README is committed.
