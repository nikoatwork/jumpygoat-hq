# Update an existing jumpyGoatHq deployment

Use this when the core repo has changed and an existing VPS/systemd install needs to pull, rebuild, migrate local SQLite state, and restart services.

This guide assumes the recommended layout from [`DEPLOY.md`](DEPLOY.md):

```txt
/root/jumpygoat-hq-deploy/
  jumpygoat-hq/           # core git checkout; safe to update
  jumpygoat-hq-instance/  # private mutable instance data; back this up
  bin/jghq                # optional helper
  ops/                    # operator notes/backups
```

The core checkout is updateable. The instance directory is the data you care about.

## Quick update

SSH to the server, then run:

```bash
cd /root/jumpygoat-hq-deploy/jumpygoat-hq

git pull
pnpm install
JUMPYGOATHQ_HOME=/root/jumpygoat-hq-deploy/jumpygoat-hq-instance pnpm setup:db
pnpm build
JUMPYGOATHQ_HOME=/root/jumpygoat-hq-deploy/jumpygoat-hq-instance pnpm run doctor
systemctl restart jumpygoat-hq-web
```

Check the service and recent file logs:

```bash
systemctl status jumpygoat-hq-web --no-pager
journalctl -u jumpygoat-hq-web -n 80 --no-pager
tail -80 /root/jumpygoat-hq-deploy/jumpygoat-hq-instance/data/logs/web.jsonl 2>/dev/null || true
tail -80 /root/jumpygoat-hq-deploy/jumpygoat-hq-instance/data/logs/errors.jsonl 2>/dev/null || true
```

## Update with the optional `jghq` helper

If `/root/jumpygoat-hq-deploy/bin/jghq` exists:

```bash
cd /root/jumpygoat-hq-deploy/jumpygoat-hq

git pull
pnpm install
/root/jumpygoat-hq-deploy/bin/jghq setup:db
pnpm build
/root/jumpygoat-hq-deploy/bin/jghq run doctor
systemctl restart jumpygoat-hq-web
```

## Back up before larger updates

For bigger updates or before pulling a branch with migrations:

```bash
tar -czf /root/jumpygoat-hq-deploy/ops/jumpygoat-hq-instance-$(date +%F-%H%M).tgz \
  -C /root/jumpygoat-hq-deploy jumpygoat-hq-instance
```

## Verify web and JSON API

From the server:

```bash
curl -fsS http://127.0.0.1:3000/ >/dev/null && echo "web ok"
curl -fsS http://127.0.0.1:3000/api/agents | head
```

If the web service is bound to a Tailscale address, test from your laptop:

```bash
curl -fsS http://100.x.y.z:3000/ >/dev/null && echo "web ok"
curl -fsS http://100.x.y.z:3000/api/agents | head
```

If `JUMPYGOATHQ_API_TOKEN` is set, include it:

```bash
curl -fsS \
  -H "Authorization: Bearer $JUMPYGOATHQ_API_TOKEN" \
  http://127.0.0.1:3000/api/agents | head
```

## Verify remote CLI from your laptop

Configure the instance once:

```bash
jumpygoathq instances add vps --api-url http://100.x.y.z:3000
jumpygoathq instances use vps
```

If the server requires an API token:

```bash
jumpygoathq instances add vps --api-url http://100.x.y.z:3000 --token "$JUMPYGOATHQ_API_TOKEN"
jumpygoathq instances use vps
```

Then test:

```bash
jumpygoathq --instance vps agents list
jumpygoathq --instance vps runs list --limit 5
```

## Reinstall cron entries when schedules change

`git pull` does not rewrite existing crontab blocks. If an automation schedule changed, reinstall that automation cron entry:

```bash
cd /root/jumpygoat-hq-deploy/jumpygoat-hq
JUMPYGOATHQ_HOME=/root/jumpygoat-hq-deploy/jumpygoat-hq-instance pnpm install:cron <automation-name>
JUMPYGOATHQ_HOME=/root/jumpygoat-hq-deploy/jumpygoat-hq-instance pnpm list:cron
```

If using the helper:

```bash
/root/jumpygoat-hq-deploy/bin/jghq install:cron <automation-name>
/root/jumpygoat-hq-deploy/bin/jghq list:cron
```

## Task dispatcher heartbeat

If the task dispatcher cron was installed, verify after an update:

```bash
cd /root/jumpygoat-hq-deploy/jumpygoat-hq
JUMPYGOATHQ_HOME=/root/jumpygoat-hq-deploy/jumpygoat-hq-instance pnpm list:task-cron
JUMPYGOATHQ_HOME=/root/jumpygoat-hq-deploy/jumpygoat-hq-instance pnpm dispatch:tasks
```

## Troubleshooting

Operational file logs live under `$JUMPYGOATHQ_HOME/data/logs/`: `web.jsonl`, `runner.jsonl`, and `errors.jsonl`. Use them with `journalctl` when an update appears to start but the service or runs behave differently than expected.

### `/api/...` returns 404

The running server is probably old or was not rebuilt/restarted. Run the quick update again and confirm:

```bash
cd /root/jumpygoat-hq-deploy/jumpygoat-hq
pnpm build
systemctl restart jumpygoat-hq-web
journalctl -u jumpygoat-hq-web -n 80 --no-pager
tail -80 /root/jumpygoat-hq-deploy/jumpygoat-hq-instance/data/logs/web.jsonl 2>/dev/null || true
```

### CLI returns unauthorized

The server has `JUMPYGOATHQ_API_TOKEN` set. Configure the same token locally:

```bash
jumpygoathq instances remove vps
jumpygoathq instances add vps --api-url http://100.x.y.z:3000 --token TOKEN
```

### Service starts but agents/automations are missing

Check `JUMPYGOATHQ_HOME` in the service:

```bash
systemctl cat jumpygoat-hq-web
```

It should point at the private instance directory, usually:

```txt
/root/jumpygoat-hq-deploy/jumpygoat-hq-instance
```

### Pi auth fails during runs

Authenticate Pi as the same Unix user that runs systemd/cron:

```bash
pi /login
pi --mode json --no-session "hello"
```

### Roll back code only

If the instance data is fine but the latest core code is bad:

```bash
cd /root/jumpygoat-hq-deploy/jumpygoat-hq
git log --oneline -n 10
git checkout <known-good-commit>
pnpm install
pnpm build
systemctl restart jumpygoat-hq-web
```

Instance files under `/root/jumpygoat-hq-deploy/jumpygoat-hq-instance` are not changed by `git checkout`.
