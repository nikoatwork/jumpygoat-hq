# Deploy jumpyGoatHq on your own server

This guide runs the jumpyGoatHq web UI as a `systemd` service and optionally installs scheduled automations/task dispatch with cron.

jumpyGoatHq currently has no built-in auth. Keep the web UI bound to `127.0.0.1` and use an SSH tunnel, Tailscale, or a trusted authenticated reverse proxy.

## Keep it boring

The preferred VPS setup is intentionally small:

- run the web UI under one `systemd` service;
- keep scheduled automations/task dispatch on the existing cron path unless cron becomes painful;
- keep mutable instance data outside the source checkout with `JUMPYGOATHQ_HOME`;
- avoid adding a queue, extra daemon, dashboard, reverse proxy, generated timer system, or helper script unless it removes more complexity than it adds.

Good hardening here mostly means clear paths, one responsible Unix user, localhost binding, readable logs, backups, and repeatable update commands.

## Deployment model

Use one deploy parent that contains both the updateable source checkout and the private mutable instance data:

```txt
/root/jumpygoat-hq-deploy/
  jumpygoat-hq/           # core git checkout; safe to git pull/rebuild
  jumpygoat-hq-instance/  # private mutable instance data; back this up
  bin/                    # optional operator helper scripts
  ops/                    # optional local install notes, work logs, archives
```

The important separation is:

- **Core**: `/root/jumpygoat-hq-deploy/jumpygoat-hq` — source code and dependencies. Disposable/updateable.
- **Instance**: `/root/jumpygoat-hq-deploy/jumpygoat-hq-instance` — agents, automations, boards, data, traces, settings. Precious/back up.
- **Supervisor**: systemd/cron run commands from the core checkout with `JUMPYGOATHQ_HOME` pointing at the instance.

Examples below use:

- deploy parent: `/root/jumpygoat-hq-deploy`
- core checkout: `/root/jumpygoat-hq-deploy/jumpygoat-hq`
- instance root: `/root/jumpygoat-hq-deploy/jumpygoat-hq-instance`
- Unix user: `root`
- web address on the server: `127.0.0.1:3000`

Adjust paths/usernames if you deploy under a different user such as `jumpygoat`.

## 1. Prepare the server checkout

SSH to the server as the user that will run jumpyGoatHq, create the deploy parent, clone the repo, create the instance directories, then install dependencies, initialize SQLite, and build.

Fresh clone:

```bash
mkdir -p /root/jumpygoat-hq-deploy/{bin,ops}
cd /root/jumpygoat-hq-deploy

git clone <repo-url> jumpygoat-hq
mkdir -p jumpygoat-hq-instance/{agents,automations,boards,data,workdirs,traces}

cd /root/jumpygoat-hq-deploy/jumpygoat-hq
pnpm install
JUMPYGOATHQ_HOME=/root/jumpygoat-hq-deploy/jumpygoat-hq-instance pnpm setup:db
pnpm build
JUMPYGOATHQ_HOME=/root/jumpygoat-hq-deploy/jumpygoat-hq-instance pnpm run doctor
```

If you already have a checkout, move or clone it into the same shape, then create the instance directory beside it:

```bash
mkdir -p /root/jumpygoat-hq-deploy/{bin,ops,jumpygoat-hq-instance/{agents,automations,boards,data,workdirs,traces}}
# optional compatibility symlink for old habits/scripts:
ln -sfn /root/jumpygoat-hq-deploy/jumpygoat-hq /root/jumpygoat-hq
```

`JUMPYGOATHQ_HOME` is the mutable instance root. Runtime files live directly under `$JUMPYGOATHQ_HOME/{agents,automations,boards,data,workdirs,traces}` plus optional `$JUMPYGOATHQ_HOME/settings.yml` while source code stays in the repo checkout.

Pi must be installed and authenticated for the same Unix user that will run systemd/cron:

```bash
npm install -g @earendil-works/pi-coding-agent
pi /login
pi --mode json --no-session "hello"
```

If you use API keys or connector secrets, create `.env.local` in the core checkout from the example:

```bash
cd /root/jumpygoat-hq-deploy/jumpygoat-hq
cp .env.example .env.local
chmod 600 .env.local
nano .env.local
```

## 2. Optional: add a local `jghq` helper

A helper avoids repeating the long `JUMPYGOATHQ_HOME=...` prefix:

```bash
cat >/root/jumpygoat-hq-deploy/bin/jghq <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

DEPLOY_ROOT=/root/jumpygoat-hq-deploy
CORE="$DEPLOY_ROOT/jumpygoat-hq"
INSTANCE="$DEPLOY_ROOT/jumpygoat-hq-instance"

cd "$CORE"
export JUMPYGOATHQ_HOME="$INSTANCE"

exec pnpm "$@"
EOF
chmod +x /root/jumpygoat-hq-deploy/bin/jghq
```

Use it on the server like:

```bash
/root/jumpygoat-hq-deploy/bin/jghq run doctor
/root/jumpygoat-hq-deploy/bin/jghq web
/root/jumpygoat-hq-deploy/bin/jghq runner <automation-name>
/root/jumpygoat-hq-deploy/bin/jghq install:cron <automation-name>
/root/jumpygoat-hq-deploy/bin/jghq dispatch:tasks
```

## 3. Find your pnpm path

systemd needs a stable executable path. On this project’s Pi-managed Node install it is commonly:

```txt
/root/.local/share/pi-node/current/bin/pnpm
```

Confirm on your server:

```bash
command -v pnpm
```

Use that path in `ExecStart=` below.

## 4. Create the systemd service

Create `/etc/systemd/system/jumpygoat-hq-web.service`:

```bash
cat >/etc/systemd/system/jumpygoat-hq-web.service <<'EOF'
[Unit]
Description=jumpyGoatHq web UI
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/jumpygoat-hq-deploy/jumpygoat-hq
EnvironmentFile=-/root/jumpygoat-hq-deploy/jumpygoat-hq/.env.local
Environment=HOME=/root
Environment=PATH=/root/.local/share/pi-node/current/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=HOST=127.0.0.1
Environment=PORT=3000
Environment=JUMPYGOATHQ_HOME=/root/jumpygoat-hq-deploy/jumpygoat-hq-instance
ExecStart=/root/.local/share/pi-node/current/bin/pnpm web
Restart=always
RestartSec=5
UMask=0077
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
```

If `command -v pnpm` returned a different path, update both the `PATH=` and `ExecStart=` lines accordingly.

The `UMask`, `NoNewPrivileges`, and `PrivateTmp` lines are deliberately modest hardening defaults. Avoid more restrictive systemd sandboxing until it has been tested against Pi, Node, local logs, and your chosen `JUMPYGOATHQ_HOME` path.

Enable and start the service:

```bash
systemctl daemon-reload
systemctl enable --now jumpygoat-hq-web
systemctl status jumpygoat-hq-web
```

## 5. View the web UI safely

Because the service binds to localhost, tunnel it from your laptop:

```bash
ssh -L 3000:127.0.0.1:3000 root@YOUR_SERVER_IP
```

Then open:

```txt
http://127.0.0.1:3000
```

Use `/settings` to edit instance-local semantic model profiles. The file is `$JUMPYGOATHQ_HOME/settings.yml`; it should contain only non-secret model policy labels/selectors. Pi provider auth, API keys, and custom provider config stay in Pi config or environment.

## 6. Logs and service operations

jumpyGoatHq writes dependency-free JSONL operational logs under the instance home:

```txt
/root/jumpygoat-hq-deploy/jumpygoat-hq-instance/data/logs/web.jsonl
/root/jumpygoat-hq-deploy/jumpygoat-hq-instance/data/logs/runner.jsonl
/root/jumpygoat-hq-deploy/jumpygoat-hq-instance/data/logs/errors.jsonl
```

The logs are append-only breadcrumbs for SSH debugging. They intentionally avoid request bodies, prompts, auth headers, API keys, and full Pi traces. Detailed run output/error/trace still lives in the SQLite `runs` table and on the web run detail page.

Watch the systemd journal and file logs:

```bash
journalctl -u jumpygoat-hq-web -f

tail -f /root/jumpygoat-hq-deploy/jumpygoat-hq-instance/data/logs/web.jsonl
tail -f /root/jumpygoat-hq-deploy/jumpygoat-hq-instance/data/logs/runner.jsonl
tail -f /root/jumpygoat-hq-deploy/jumpygoat-hq-instance/data/logs/errors.jsonl
```

Useful SSH checks without extra dependencies:

```bash
# recent web errors
grep '"level":"error"' /root/jumpygoat-hq-deploy/jumpygoat-hq-instance/data/logs/web.jsonl | tail -20

# recent runner starts/finishes
grep '"event":"run_' /root/jumpygoat-hq-deploy/jumpygoat-hq-instance/data/logs/runner.jsonl | tail -40

# optional, if jq is installed
jq -r '[.ts,.level,.component,.event,.run_id,.status,.message] | @tsv' /root/jumpygoat-hq-deploy/jumpygoat-hq-instance/data/logs/errors.jsonl | tail -20
```

You can set `JUMPYGOATHQ_LOG_LEVEL=debug` for more verbosity or `JUMPYGOATHQ_LOG_DIR=/some/path` to move file logs. For v1 there is no automatic rotation; periodically archive or truncate old files if your VPS disk is small.

Restart after code or config changes, keeping before/after evidence:

```bash
journalctl -u jumpygoat-hq-web -n 80 --no-pager
tail -80 /root/jumpygoat-hq-deploy/jumpygoat-hq-instance/data/logs/errors.jsonl 2>/dev/null || true

cd /root/jumpygoat-hq-deploy/jumpygoat-hq
pnpm build
systemctl restart jumpygoat-hq-web

systemctl status jumpygoat-hq-web --no-pager
journalctl -u jumpygoat-hq-web -n 80 --no-pager
tail -80 /root/jumpygoat-hq-deploy/jumpygoat-hq-instance/data/logs/web.jsonl 2>/dev/null || true
```

Stop/start manually:

```bash
systemctl stop jumpygoat-hq-web
systemctl start jumpygoat-hq-web
```

First checks by symptom:

- **Web down:** `systemctl status jumpygoat-hq-web --no-pager`, then `journalctl -u jumpygoat-hq-web -n 120 --no-pager`, then `tail -80 .../data/logs/errors.jsonl`.
- **Automation failed:** find the run id in `runner.jsonl`, inspect the run detail page or SQLite `runs` row, then check `stderr_tail` and `exit_code` in the log line.
- **Cron not firing:** run `pnpm list:cron`, check `crontab -l`, then inspect `$JUMPYGOATHQ_HOME/data/cron-<automation-name>.log` for the timestamped start/end wrapper lines.
- **Pi auth missing:** SSH as the same Unix user used by systemd/cron, run `pi /login`, then `pi --mode json --no-session "hello"`.
- **DB setup/migration issue:** rerun `JUMPYGOATHQ_HOME=... pnpm setup:db`, then check the DB path in `web.jsonl`/`runner.jsonl`.
- **Disk full:** run `df -h` and archive/truncate old `data/logs/*.jsonl`, cron logs, or old traces.
- **Permission denied:** verify the systemd `User=`, instance ownership, `.env.local` readability, and write access to `$JUMPYGOATHQ_HOME/data`.

## 7. Install scheduled automations

Cron is the default lightweight scheduler for automations. Do not add systemd automation timers unless cron is causing a concrete operational problem.

The public repo ships with no active automations. Create `$JUMPYGOATHQ_HOME/agents/<name>/AGENT.md` and `$JUMPYGOATHQ_HOME/automations/<name>.md` first (or use the web UI), then install scheduled automation runs separately into cron:

```bash
cd /root/jumpygoat-hq-deploy/jumpygoat-hq
JUMPYGOATHQ_HOME=/root/jumpygoat-hq-deploy/jumpygoat-hq-instance pnpm install:cron <automation-name>
JUMPYGOATHQ_HOME=/root/jumpygoat-hq-deploy/jumpygoat-hq-instance pnpm list:cron
```

With the optional helper:

```bash
/root/jumpygoat-hq-deploy/bin/jghq install:cron <automation-name>
/root/jumpygoat-hq-deploy/bin/jghq list:cron
```

Remove a scheduled automation:

```bash
JUMPYGOATHQ_HOME=/root/jumpygoat-hq-deploy/jumpygoat-hq-instance pnpm uninstall:cron <automation-name>
```

Cron logs are written under `$JUMPYGOATHQ_HOME/data/`, for example `/root/jumpygoat-hq-deploy/jumpygoat-hq-instance/data/cron-<automation-name>.log`. The generated cron wrapper preserves `HOME`, `PATH`, `JUMPYGOATHQ_HOME`, and `JUMPYGOATHQ_DB_PATH` from install time and writes timestamped start/end lines with the exit code around each command.

Install cron as the same Unix user that ran `pi /login`, so Pi can reuse its stored auth.

## 8. Install task dispatcher heartbeat

Boards and tasks live under `$JUMPYGOATHQ_HOME/boards`. The dispatcher assumes one local heartbeat process/timer and claims one `ready` assigned task per run by default:

```bash
cd /root/jumpygoat-hq-deploy/jumpygoat-hq
JUMPYGOATHQ_HOME=/root/jumpygoat-hq-deploy/jumpygoat-hq-instance pnpm dispatch:tasks
```

Cron example, every five minutes:

```cron
*/5 * * * * cd /root/jumpygoat-hq-deploy/jumpygoat-hq && JUMPYGOATHQ_HOME=/root/jumpygoat-hq-deploy/jumpygoat-hq-instance /root/.local/share/pi-node/current/bin/pnpm dispatch:tasks >> /root/jumpygoat-hq-deploy/jumpygoat-hq-instance/data/task-dispatch.log 2>&1
```

For systemd timers, use the same `WorkingDirectory`, `EnvironmentFile`, `HOME`, `PATH`, and `JUMPYGOATHQ_HOME` pattern as the web service, with `ExecStart=<pnpm-path> dispatch:tasks`.

## 9. Updating an existing deployment

The core checkout is safe to update. The instance directory is not touched by `git pull` and should be backed up separately.

For the full update checklist, API verification, remote CLI verification, cron notes, and troubleshooting, see [`UPDATE.md`](UPDATE.md).

Quick update:

```bash
cd /root/jumpygoat-hq-deploy/jumpygoat-hq
git pull
pnpm install
JUMPYGOATHQ_HOME=/root/jumpygoat-hq-deploy/jumpygoat-hq-instance pnpm setup:db
pnpm build
JUMPYGOATHQ_HOME=/root/jumpygoat-hq-deploy/jumpygoat-hq-instance pnpm run doctor
systemctl restart jumpygoat-hq-web
```

## 10. Back up instance data

Back up the instance directory, not `node_modules` or build output:

```bash
tar -czf /root/jumpygoat-hq-deploy/ops/jumpygoat-hq-instance-$(date +%F).tgz \
  -C /root/jumpygoat-hq-deploy jumpygoat-hq-instance
```

Restore by placing the directory back at `/root/jumpygoat-hq-deploy/jumpygoat-hq-instance`, then running:

```bash
cd /root/jumpygoat-hq-deploy/jumpygoat-hq
JUMPYGOATHQ_HOME=/root/jumpygoat-hq-deploy/jumpygoat-hq-instance pnpm setup:db
systemctl restart jumpygoat-hq-web
```

## 11. Record local install details

For long-lived VPS installs, keep an operator note outside the core checkout, for example:

```txt
/root/jumpygoat-hq-deploy/ops/INSTALLATION_AND_NEXT_STEPS.md
```

A template is available at [`docs/deploy/INSTALLATION_RECORD.template.md`](deploy/INSTALLATION_RECORD.template.md). Copy it into your deploy `ops/` directory and fill in the server-specific values.

## Notes

- Runtime and personal instance state is intentionally outside source when `JUMPYGOATHQ_HOME` is set: `$JUMPYGOATHQ_HOME/{agents,automations,boards,data,workdirs,traces}` and optional `$JUMPYGOATHQ_HOME/settings.yml`. Local development uses gitignored `workspace/{agents,automations,boards,data,workdirs,traces}` plus `workspace/settings.yml` by default.
- Keep `HOST=127.0.0.1` unless the service is behind trusted auth/proxy/firewall.
- For a non-root deployment, replace `User=`, `WorkingDirectory=`, `EnvironmentFile=`, `HOME=`, and the executable paths with that user’s values.
