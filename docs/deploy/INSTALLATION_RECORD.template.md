# jumpyGoatHq installation record

Copy this file to your deploy machine, for example:

```txt
/root/jumpygoat-hq-deploy/ops/INSTALLATION_AND_NEXT_STEPS.md
```

Keep server-specific operational notes here. Do not commit private IPs, secrets, tokens, or personal instance data to the public repo.

## Server

```txt
Hostname/IP:
SSH user:
SSH command:
```

## Folder layout

```txt
Deploy parent:
Core checkout:
Instance root:
Helper CLI:
Ops notes:
```

Recommended default:

```txt
/root/jumpygoat-hq-deploy/
  jumpygoat-hq/           # core git checkout; safe to git pull
  jumpygoat-hq-instance/  # private mutable instance data; back this up
  bin/jghq                # optional server-side helper
  ops/                    # install notes, work logs, archives
```

## Environment

```bash
JUMPYGOATHQ_HOME=
HOST=127.0.0.1
PORT=3000
```

Secrets/env file:

```txt
<core-checkout>/.env.local
```

## Pi

```txt
Unix user that ran pi /login:
Pi smoke command status:
pi --mode json --no-session "hello"
```

## systemd web service

```txt
Service name: jumpygoat-hq-web.service
Unit path: /etc/systemd/system/jumpygoat-hq-web.service
WorkingDirectory:
EnvironmentFile:
JUMPYGOATHQ_HOME:
pnpm path:
Bind address: 127.0.0.1:3000
```

Common commands:

```bash
systemctl status jumpygoat-hq-web
journalctl -u jumpygoat-hq-web -f
systemctl restart jumpygoat-hq-web
```

## Web access

SSH tunnel from laptop:

```bash
ssh -L 3000:127.0.0.1:3000 <user>@<host>
```

Then open:

```txt
http://127.0.0.1:3000
```

## Helper CLI

If installed:

```bash
<deploy-parent>/bin/jghq run doctor
<deploy-parent>/bin/jghq web
<deploy-parent>/bin/jghq runner <automation-name>
<deploy-parent>/bin/jghq install:cron <automation-name>
<deploy-parent>/bin/jghq dispatch:tasks
```

## Update flow

Core update instructions ship with the repo at:

```txt
<core-checkout>/docs/UPDATE.md
```

Quick command:

```bash
cd <core-checkout>
git pull
pnpm install
JUMPYGOATHQ_HOME=<instance-root> pnpm setup:db
pnpm build
JUMPYGOATHQ_HOME=<instance-root> pnpm run doctor
systemctl restart jumpygoat-hq-web
```

## Backups

Instance backup command:

```bash
tar -czf <deploy-parent>/ops/jumpygoat-hq-instance-$(date +%F).tgz \
  -C <deploy-parent> jumpygoat-hq-instance
```

Back up at least:

```txt
<instance-root>/agents/
<instance-root>/automations/
<instance-root>/boards/
<instance-root>/data/
<instance-root>/settings.yml
```

## Cron / automations

Installed automation cron entries:

```txt
- 
```

Commands:

```bash
JUMPYGOATHQ_HOME=<instance-root> pnpm list:cron
JUMPYGOATHQ_HOME=<instance-root> pnpm install:cron <automation-name>
JUMPYGOATHQ_HOME=<instance-root> pnpm uninstall:cron <automation-name>
```

## Task dispatcher

Heartbeat installed?

```txt
No / Yes:
Schedule:
Log path:
```

Manual check:

```bash
cd <core-checkout>
JUMPYGOATHQ_HOME=<instance-root> pnpm dispatch:tasks
```

## Next steps

- [ ] Create first agent under `<instance-root>/agents/<name>/AGENT.md`.
- [ ] Create first automation under `<instance-root>/automations/<name>.md`.
- [ ] Run `pnpm runner <automation-name>` manually.
- [ ] Install cron for scheduled automations.
- [ ] Configure task dispatcher heartbeat if using boards/tasks.
- [ ] Configure connector secrets in `.env.local` if needed.
- [ ] Decide backup cadence for the instance directory.
