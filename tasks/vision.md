# vision

agenthq is a **personal scheduled-skill runner**: cron/systemd runs Pi skills against plain-English prompts, stores the run history in SQLite, and lets me inspect what happened.

This is deliberately **not** a workflow builder. No DAGs, no nodes, no deterministic pipeline UI. The primitive to test is:

> a capable agent harness + a well-written skill + a recurring prompt

Pi is the harness.

## The primitive

**An automation is a single markdown file.** It says:

- which Pi skill/context to load
- which model to use, if overriding Pi defaults
- when to run
- what prompt to give the agent

Example:

```markdown
---
skill: daily-review
schedule: "manual"
model: anthropic/claude-sonnet-4-5
---

Review the workspace notes and open issues. Tell me what needs attention today.
```

Edit the file → edit the automation.

## Runtime state

Past runs are stored in local SQLite:

```txt
data/agenthq.sqlite
```

The DB is gitignored. It stores:

- status
- timestamps/duration
- assistant output text
- raw Pi JSON trace text
- stderr/error text

Auth should preferably reuse Pi's own stored login: run `pi /login` as the same Unix user that runs agenthq/cron. `.env` is optional and gitignored for provider env vars or local overrides.

## The bet

A scheduled **skill-like agent run** can replace a meaningful slice of recurring manual work better than a workflow graph can.

The agent decides the steps. Pi provides the loop and tools. The skill gives repeatable context and instructions. Cron/systemd gives time.

## Current user model

Personal-first:

- operator = user = me
- no multi-user assumptions
- no end-user dashboard requirement yet
- no public SaaS, no RBAC, no team auth

## v0

Local/server first:

1. one Pi skill
2. one automation markdown file
3. `agenthq-runner <automation>` invokes Pi headlessly
4. run is stored in SQLite
5. `pnpm install:cron <automation>` installs the schedule on the server
6. inspect with `sqlite3` or a later tiny viewer

## When to stop

If scheduled Pi skills do not produce useful recurring work with less effort than doing it manually, stop. Do not build a platform around a primitive that has not proven itself.
