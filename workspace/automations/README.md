# workspace/automations

Local active automations live here by default. Set `JUMPYGOATHQ_HOME=/path/to/jumpygoat-hq-home` to use an external workspace; then active automations live in `$JUMPYGOATHQ_HOME/automations/`.

Each automation is one markdown file:

```text
workspace/automations/<automation-name>.md
```

Automation frontmatter owns the invocation source: schedule, prompt, agent reference, and run-specific non-secret overrides. It must reference an agent:

```markdown
---
agent: your-agent
schedule: manual # or a 5-field cron expression
model: gpt-5.5 # optional; overrides the agent default model
---

Prompt for this run.
```

Connector defaults belong on the agent. Add connector blocks here only for per-run non-secret overrides, for example a different notification recipient. Secrets, provider schemas, side-effect behavior, and connector audit records belong to connectors/tools, not automation files.

This directory is mutable operator state. Automation files are gitignored; only this README is committed.
