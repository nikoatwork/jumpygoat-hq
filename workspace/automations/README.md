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

Connector defaults belong on the agent. Add connector blocks here only for per-run non-secret overrides, for example a different notification recipient, AgentMail inbox filter, or a narrower script allowlist:

```yaml
---
agent: your-agent
schedule: manual
mail:
  send:
    enabled: true
    connector: agentmail
    inboxId: agent@agentmail.to
    to: operator@example.com
  list:
    enabled: true
    connector: agentmail
    inboxId: agent@agentmail.to
    limit: 10
    labels: [unread]
---

Check the inbox for unread messages and send a response if needed.
```

Script override example:

```yaml
---
agent: real-estate-searcher
schedule: manual
scripts:
  run:
    enabled: true
    connector: local-script
    allow:
      - scripts/search-immoscout.ts
    network: true
    write: true
    timeoutMs: 60000
    maxOutputChars: 12000
---

Run the allowlisted search script, summarize new listings, and send any requested follow-up through connector tools.
```

Artifact upload override example:

```yaml
---
agent: report-agent
schedule: manual
artifacts:
  upload:
    enabled: true
    connector: r2
    expiresInSeconds: 604800
    maxFileBytes: 50000000
---

Create `output/report.pdf`, upload it with `artifact_upload`, and send the returned URL through the configured mail or notification tool.
```

Secrets, provider schemas, side-effect behavior, and connector audit records belong to connectors/tools, not automation files.

This directory is mutable operator state. Automation files are gitignored; only this README is committed.
