# Task 02 — Personal VPS/systemd deployment

## Context

After Task 01 proves the local Pi-backed runner, deploy it as personal infrastructure. Still no multi-user product surface.

Goal:

> systemd timer → `agenthq-runner <automation>` → Pi JSON trace on disk

No MCP work. No public dashboard requirement. No Caddy/basic-auth unless a web viewer exists and is worth exposing.

## Brief

Make local scheduled skills run continuously on a VPS or always-on machine.

Build:

1. systemd service/timer templates.
2. `install-automation.sh` that reads schedule from automation frontmatter.
3. bootstrap/deploy notes for installing Pi and agenthq.
4. basic operator commands for inspecting timers, logs, traces, and cost.

## Target files

```txt
systemd/
  agenthq@.service
  agenthq@.timer

scripts/
  install-automation.sh
  uninstall-automation.sh
  cost.sh
  bootstrap.sh        # optional, only after manual deploy is understood

docs/
  DEPLOY.md
```

## Deployment stance

Start boring:

- one Linux box
- one Unix user: `agenthq`
- repo at `/opt/agenthq/src`
- workspaces/traces under repo or `/opt/agenthq/data`
- `.env` owned by `agenthq`, mode `0600`
- Pi installed globally or via project dependency, whichever is simplest

## Tasks

- [ ] 1.0 systemd runner templates
  - [ ] 1.1 `agenthq@.service`: oneshot, runs `pnpm --filter @agenthq/runner start %i` or built JS equivalent
  - [ ] 1.2 Set `WorkingDirectory=/opt/agenthq/src`
  - [ ] 1.3 Set `EnvironmentFile=/opt/agenthq/.env`
  - [ ] 1.4 Run as `User=agenthq`
  - [ ] 1.5 Log to journald

- [ ] 2.0 timer install script
  - [ ] 2.1 Parse `schedule` from `automations/<name>.md`
  - [ ] 2.2 Generate timer drop-in for `agenthq@<name>.timer`
  - [ ] 2.3 `systemctl daemon-reload`
  - [ ] 2.4 `systemctl enable --now agenthq@<name>.timer`
  - [ ] 2.5 Add uninstall script to disable/remove timer drop-in

- [ ] 3.0 Pi install/runtime notes
  - [ ] 3.1 Document installing `@earendil-works/pi-coding-agent`
  - [ ] 3.2 Document required auth/API key setup
  - [ ] 3.3 Confirm headless `pi --mode json --no-session "hello"` works under `agenthq` user
  - [ ] 3.4 Document model selection via automation frontmatter

- [ ] 4.0 Operator commands
  - [ ] 4.1 `systemctl list-timers 'agenthq@*'`
  - [ ] 4.2 `journalctl -u agenthq@<name>.service -f`
  - [ ] 4.3 inspect latest trace
  - [ ] 4.4 manually run automation
  - [ ] 4.5 disable automation

- [ ] 5.0 Cost/summary helper
  - [ ] 5.1 `scripts/cost.sh` reads `agenthq_summary` and/or Pi usage events if available
  - [ ] 5.2 Show today total and recent runs
  - [ ] 5.3 Keep this best-effort; do not block deploy on perfect cost accounting

- [ ] 6.0 Deploy docs
  - [ ] 6.1 `docs/DEPLOY.md`: fresh box setup
  - [ ] 6.2 update loop: git pull, pnpm install/build, restart timers if needed
  - [ ] 6.3 troubleshooting: Pi auth missing, model not found, timer not firing, workspace permissions

## Deferred

- public web dashboard
- Caddy/basic auth
- GitHub Actions deployment
- MCP servers
- custom sandboxing
