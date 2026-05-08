# Task 03 — Optional observability/dashboard

## Context

This task is now deferred until the Pi-backed runner is useful in real personal use.

The previous version assumed a non-technical multi-user control plane. That is no longer the current goal. For now, files are the authoring surface and the terminal is acceptable.

## New goal

If Task 01 and Task 02 prove useful, add a small personal dashboard/read-only viewer:

- list automations
- list runs
- inspect trace events
- show status/duration/cost summary
- maybe provide a manual “run now” button

Do **not** build a full no-code editor yet.

## Possible scope

### Read-only first

- [ ] 1.0 Minimal web viewer
  - [ ] 1.1 Next.js or simpler static/server app
  - [ ] 1.2 Read `automations/*.md`
  - [ ] 1.3 Read `traces/*.jsonl`
  - [ ] 1.4 Show newest runs first
  - [ ] 1.5 Run detail page: raw Pi events + summary
  - [ ] 1.6 Automation detail page: frontmatter + prompt + recent runs

### Convenience actions

- [ ] 2.0 Manual trigger, if desired
  - [ ] 2.1 `POST /api/run/<automation>` shells out to runner
  - [ ] 2.2 Return run id
  - [ ] 2.3 Navigate to trace page
  - [ ] 2.4 Keep this local/private only

### Cost/failure surfacing

- [ ] 3.0 Summary UI
  - [ ] 3.1 today’s runs
  - [ ] 3.2 failures
  - [ ] 3.3 duration/cost where available

## Explicitly deferred

- create/edit automations in browser
- schedule picker
- agent/skill marketplace
- multi-user auth
- RBAC
- public dashboard
- Slack failure webhook
- magic-link login

## Re-entry criteria

Only start this task after at least one real automation has run repeatedly and produced value.
