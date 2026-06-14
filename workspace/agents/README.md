# workspace/agents

Local active agents live here by default. Set `JUMPYGOATHQ_HOME=/path/to/jumpygoat-hq-home` to use an external workspace; then active agents live in `$JUMPYGOATHQ_HOME/agents/`.

Each agent is an jumpyGoatHq bundle: identity, instructions, scoped context, defaults, and capability policy. Runtime loading is deliberately minimal today:

```text
workspace/agents/<name>/AGENT.md          # required; loaded every run
workspace/agents/<name>/context/*.md      # optional; loaded alphabetically
```

Optional agent-local resources are private to the bundle and loaded/executed only through explicit contracts:

```text
workspace/agents/<name>/references/       # reserved future reference docs
workspace/agents/<name>/templates/        # reserved future templates
workspace/agents/<name>/assets/           # reserved future static assets
workspace/agents/<name>/procedures/       # reserved future reusable procedures
workspace/agents/<name>/scripts/          # optional TypeScript scripts gated by script.run
workspace/agents/<name>/state/            # optional durable script state, agent-private
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
  - mail.send
  - mail.list
  - script.run
  - artifact.upload
  - actor.run
web:
  search:
    enabled: true
    connector: firecrawl
    limit: 5
notify:
  email:
    enabled: false
    connector: resend
mail:
  send:
    enabled: false
    connector: agentmail
    inboxId: agent@agentmail.to
  list:
    enabled: false
    connector: agentmail
    inboxId: agent@agentmail.to
    limit: 10
scripts:
  run:
    enabled: false
    connector: local-script
    allow:
      - scripts/example.ts
    network: false
    write: false
    timeoutMs: 60000
    maxOutputChars: 12000
artifacts:
  upload:
    enabled: false
    connector: r2
    expiresInSeconds: 604800
    maxFileBytes: 25000000
actors:
  run:
    enabled: false
    connector: apify
    allow:
      - apidojo/tweet-scraper
    actor: apidojo/tweet-scraper
    maxOutputItems: 25
    maxOutputChars: 20000
    timeoutMs: 300000
---

## Instructions

Tell Pi who this agent is, how it should work, what it should not do, and when it may use connector tools.
```

Supported connector intents are `web.search`, `web.scrape`, `web.crawl`, `notify.email`, `mail.send`, `mail.list`, `script.run`, `artifact.upload`, and `actor.run`. `allowedIntents` is the capability gate. Connector config in `AGENT.md` provides non-secret defaults; automation/task invocation frontmatter may override run-specific non-secret values when needed. `script.run` can execute only allowlisted `.ts`/`.tsx` files under this agent's `scripts/` folder; persistent script state should stay under `state/`. `artifact.upload` can upload relative files from the run workspace or active agent folder to Cloudflare R2 and return an expiring signed URL. `actor.run` can run only Apify actor IDs listed in the agent's `actors.run.allow`; automations may select one of those actors and provide JSON/YAML input defaults, but cannot expand the allowlist.

Context files under `context/*.md` are loaded alphabetically by filename and appended to the generated Pi instruction file for each run. Recommended naming: `00-overview.md`, `10-playbook.md`, `20-style.md`. Keep context markdown deterministic and non-secret unless your `JUMPYGOATHQ_HOME` is private.

Future loaded resources must use explicit jumpyGoatHq rules for naming, ordering, size limits, and execution/audit behavior. Until those contracts exist, `references/`, `templates/`, `assets/`, `procedures/`, and `memory/` are non-loaded authoring space only. `scripts/` is executable only through the gated `script.run` connector.

This directory is mutable operator state. Agent directories are gitignored; only this README is committed.
