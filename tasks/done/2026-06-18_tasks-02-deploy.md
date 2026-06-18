# Task 02 — Personal VPS/systemd deployment

## Context

After the local Pi-backed runner/web/API/CLI primitives, deploy jumpyGoatHq as personal infrastructure. Still no multi-user product surface.

Original goal:

> systemd timer → `jumpygoathq`/runner automation invocation → Pi JSON trace/run audit on disk/SQLite

Current repo context: cron-first automation/task scheduling, lightweight VPS logging, web/API/CLI setup commands, model profiles, and `JUMPYGOATHQ_HOME` already exist. Treat this task as VPS hardening/systemd packaging, not the first deployment path.

No MCP work. No public dashboard requirement. No Caddy/basic-auth unless explicitly choosing to expose the existing web viewer behind trusted auth/proxy.

## Dependencies

- Builds on completed local runner/web/API/CLI primitives and cron/logging work.
- Independent of the chat/memory tasks.
- Optional relative to existing cron deployment; this task is for systemd/VPS hardening.

## Brief

Make local scheduled agents run continuously on a VPS or always-on machine with a systemd-native option.

Keep this light. The current cron/local deployment path already works reasonably well; this task should harden and clarify VPS operation without creating a second complex platform. Prefer the smallest useful docs/templates/scripts over broad automation.

Build or document only what is needed:

1. systemd service/timer templates for automation runs and optionally task heartbeat.
2. installer/uninstaller scripts or CLI wrappers that read schedule from automation frontmatter and use `JUMPYGOATHQ_HOME`, but only if they reduce operator burden more than they add maintenance surface.
3. bootstrap/deploy notes for installing Pi and jumpyGoatHq.
4. basic operator commands for inspecting timers, logs, traces, run history, and usage/cost.

## Target files

```txt
systemd/
  jumpygoathq-automation@.service
  jumpygoathq-automation@.timer
  jumpygoathq-task-heartbeat.service   # optional if systemd also replaces task cron
  jumpygoathq-task-heartbeat.timer     # optional if systemd also replaces task cron

scripts/
  install-systemd-automation.sh
  uninstall-systemd-automation.sh
  install-systemd-task-heartbeat.sh     # optional
  uninstall-systemd-task-heartbeat.sh   # optional
  bootstrap.sh                          # optional, only after manual deploy is understood

docs/
  DEPLOY.md
```

## Deployment stance

Start boring:

- one Linux box
- one Unix user: `jumpygoathq`
- repo at `/opt/jumpygoathq/src`
- mutable state under `JUMPYGOATHQ_HOME=/var/lib/jumpygoathq` or `/opt/jumpygoathq/data`
- `.env` owned by `jumpygoathq`, mode `0600`
- Pi installed globally or via project dependency, whichever is simplest

## Fresh-agent context

- Bias strongly toward simplicity: every simplification made and every unnecessary line of code removed is a win, as long as the deployment goal is still met.
- Existing cron scripts already install/list/uninstall automation cron blocks and task heartbeat cron. Do not duplicate cron behavior unless systemd intentionally replaces or complements it.
- Existing lightweight logging task added JSONL/logging docs for VPS operations. Link to/reuse that work instead of inventing a second logging story.
- `JUMPYGOATHQ_HOME` is the deployment state boundary. Do not write active agents/automations/boards into the app source tree unless the operator explicitly chooses repo-local state.
- The package name is now `@jumpygoat-hq/*`; old `agenthq` names in this task are historical and should not leak into new scripts.
- If a documentation-only answer is enough for a deployment concern, prefer documentation over a new script or abstraction.

## Current lightweight read

`docs/DEPLOY.md` already covers the most important VPS shape: web under systemd, scheduled work through existing cron helpers, `JUMPYGOATHQ_HOME` outside the source checkout, logs, update commands, troubleshooting, and backups.

Given the current setup is working, the next pass should be an audit/hardening pass, not a build-out. Favor closing gaps in docs and removing ambiguity over adding new scripts. In particular, keep cron as the default automation scheduler unless a real operational problem appears.

Small wins completed:

- [x] Add a “keep it boring” deployment note to `docs/DEPLOY.md`.
- [x] Document `chmod 600 .env.local` in the VPS setup path.
- [x] Clarify that cron remains the default lightweight scheduler for automations.
- [x] Add modest systemd web-service hardening defaults: `UMask=0077`, `NoNewPrivileges=true`, and `PrivateTmp=true`.
- [x] Review whether existing deploy/update docs need new code or generated systemd automation timers.
- [x] Decide this task can close without adding systemd automation timers, install scripts, or a second scheduling path.

## Completion outcome

Closed as a lightweight hardening/docs pass. The current VPS shape is good enough: web service under systemd, scheduled automations/task heartbeat on existing cron helpers, explicit `JUMPYGOATHQ_HOME`, JSONL logs, update commands, troubleshooting, and backups. Additional systemd automation templates/scripts would add more maintenance surface than value right now.

## Tasks

- [x] 1.0 systemd runner templates
  - [x] 1.1 Treat this as optional unless cron becomes painful; do not add templates just because the original task mentioned them.
  - [x] 1.2 Decided not to add `jumpygoathq-automation@.service` for now; existing cron wrappers are simpler and already log to runtime files.
  - [x] 1.3 Avoided introducing a second canonical layout.
  - [x] 1.4 Kept `EnvironmentFile` guidance in `docs/DEPLOY.md` for the web service.
  - [x] 1.5 Documented running cron/Pi under the same Unix user that authenticated Pi.
  - [x] 1.6 Preserved journald plus existing JSONL/runtime logs.

- [x] 2.0 timer install path
  - [x] 2.1 Decided plain documented cron helpers are enough for v1.
  - [x] 2.2 Did not add schedule parsing for systemd timers.
  - [x] 2.3 Did not generate timer/drop-in files.
  - [x] 2.4 No daemon reload needed because no new systemd units were added.
  - [x] 2.5 No automation timer enable command needed.
  - [x] 2.6 Existing cron uninstall docs/scripts are enough.
  - [x] 2.7 Task heartbeat remains on the existing cron helper path.

- [x] 3.0 Pi install/runtime notes
  - [x] 3.1 Document installing `@earendil-works/pi-coding-agent`.
  - [x] 3.2 Document required auth/API key setup.
  - [x] 3.3 Document headless `pi --mode json --no-session "hello"` under the same runtime user.
  - [x] 3.4 Existing model profile/frontmatter docs remain the model-selection path.

- [x] 4.0 Operator commands
  - [x] 4.1 Systemd timer inspection intentionally not added for automations.
  - [x] 4.2 Web journal inspection documented with `journalctl -u jumpygoat-hq-web -f`.
  - [x] 4.3 Run/log inspection documented through JSONL logs, SQLite/web run detail, and trace/output tails.
  - [x] 4.4 Manual automation run documented through `pnpm runner <automation-name>` / helper usage.
  - [x] 4.5 Disable automation documented through existing cron uninstall helper.

- [x] 5.0 Usage/cost inspection
  - [x] 5.1 Reused existing run usage/model-profile summaries; no parallel legacy summary format added.
  - [x] 5.2 Did not add a new cost script; recent runs remain available through existing run storage/web surfaces.
  - [x] 5.3 Kept cost accounting best-effort and non-blocking.

- [x] 6.0 Deploy docs
  - [x] 6.1 `docs/DEPLOY.md`: fresh box setup.
  - [x] 6.2 Update loop: git pull, pnpm install/build, setup DB, doctor, restart web.
  - [x] 6.3 Troubleshooting: Pi auth missing, cron not firing, DB issue, disk full, workspace permissions.
  - [x] 6.4 Included a “keep it boring” note: no extra daemon, queue, dashboard, or script unless it removes more complexity than it adds.

## Resolved decisions

- Systemd runs the web service; cron remains the default scheduler for automations and task heartbeat.
- No automation/task systemd units were added in this pass.
- The documented service name remains `jumpygoat-hq-web`.
- The documented deploy path keeps `.env.local` in the core checkout and instance state under `JUMPYGOATHQ_HOME`; operators can adjust paths for non-root installs.
- Web/API exposure remains local/private by default: bind `127.0.0.1` and use SSH tunnel, Tailscale, or trusted authenticated proxy if needed.

## Deferred

- public web dashboard
- Caddy/basic auth unless explicitly chosen for a private web/API deployment note
- GitHub Actions deployment
- MCP servers
- custom sandboxing
