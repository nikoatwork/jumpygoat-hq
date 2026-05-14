# workspace/automations

Local active automations live here by default. Set `AGENTHQ_HOME=/path/to/agenthq-home` to use an external workspace; then active automations live in `$AGENTHQ_HOME/automations/`.

Each automation is one markdown file:

```text
workspace/automations/<automation-name>.md
```

Automation frontmatter owns schedule and run-specific overrides. It must reference an agent:

```markdown
---
agent: your-agent
schedule: manual # or a 5-field cron expression
model: gpt-5.5 # optional; overrides the agent default model
---

Prompt for this run.
```

Connector defaults belong on the agent. Add connector blocks here only for per-run overrides, for example a different notification recipient.

This directory is mutable operator state. Automation files are gitignored; only this README is committed.
