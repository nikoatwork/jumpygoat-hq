# Deploy agenthq on your own server

This guide runs the agenthq web UI as a `systemd` service and installs scheduled automations with cron.

agenthq currently has no built-in auth. Keep the web UI bound to `127.0.0.1` and use an SSH tunnel, Tailscale, or a trusted authenticated reverse proxy.

## Assumptions

Examples below use:

- repo path: `/root/jumpygoat-hq`
- mutable workspace: `/var/lib/agenthq`
- Unix user: `root`
- web address on the server: `127.0.0.1:3000`

Adjust paths/usernames if you deploy under a different user such as `agenthq`.

## 1. Prepare the server checkout

SSH to the server as the user that will run agenthq, create an external mutable workspace, then install dependencies, initialize SQLite, and build:

```bash
mkdir -p /var/lib/agenthq/{agents,automations,projects,data,workspaces,traces}
cd /root/jumpygoat-hq

pnpm install
AGENTHQ_HOME=/var/lib/agenthq pnpm setup:db
pnpm build
AGENTHQ_HOME=/var/lib/agenthq pnpm run doctor
```

`AGENTHQ_HOME` is the mutable instance root. Runtime files live directly under `$AGENTHQ_HOME/{agents,automations,projects,data,workspaces,traces}` plus optional `$AGENTHQ_HOME/settings.yml` while source code stays in the repo checkout.

Pi must be installed and authenticated for the same Unix user that will run systemd/cron:

```bash
npm install -g @earendil-works/pi-coding-agent
pi /login
pi --mode json --no-session "hello"
```

If you use API keys or connector secrets, create `.env.local` from the example:

```bash
cp .env.example .env.local
nano .env.local
```

## 2. Find your pnpm path

systemd needs a stable executable path. On this project’s Pi-managed Node install it is commonly:

```txt
/root/.local/share/pi-node/current/bin/pnpm
```

Confirm on your server:

```bash
command -v pnpm
```

Use that path in `ExecStart=` below.

## 3. Create the systemd service

Create `/etc/systemd/system/agenthq-web.service`:

```bash
cat >/etc/systemd/system/agenthq-web.service <<'EOF'
[Unit]
Description=AgentHQ web UI
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/jumpygoat-hq
EnvironmentFile=-/root/jumpygoat-hq/.env.local
Environment=HOME=/root
Environment=PATH=/root/.local/share/pi-node/current/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
Environment=HOST=127.0.0.1
Environment=PORT=3000
Environment=AGENTHQ_HOME=/var/lib/agenthq
ExecStart=/root/.local/share/pi-node/current/bin/pnpm web
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

If `command -v pnpm` returned a different path, update both the `PATH=` and `ExecStart=` lines accordingly.

Enable and start the service:

```bash
systemctl daemon-reload
systemctl enable --now agenthq-web
systemctl status agenthq-web
```

## 4. View the web UI safely

Because the service binds to localhost, tunnel it from your laptop:

```bash
ssh -L 3000:127.0.0.1:3000 root@YOUR_SERVER_IP
```

Then open:

```txt
http://127.0.0.1:3000
```

Use `/settings` to edit instance-local semantic model profiles. The file is `$AGENTHQ_HOME/settings.yml`; it should contain only non-secret model policy labels/selectors. Pi provider auth, API keys, and custom provider config stay in Pi config or environment.

## 5. Logs and service operations

Watch logs:

```bash
journalctl -u agenthq-web -f
```

Restart after code or config changes:

```bash
cd /root/jumpygoat-hq
pnpm build
systemctl restart agenthq-web
```

Stop/start manually:

```bash
systemctl stop agenthq-web
systemctl start agenthq-web
```

## 6. Install scheduled automations

The public repo ships with no active automations. Create `$AGENTHQ_HOME/agents/<name>/AGENT.md` and `$AGENTHQ_HOME/automations/<name>.md` first (or use the web UI), then install scheduled automation runs separately into cron:

```bash
cd /root/jumpygoat-hq
AGENTHQ_HOME=/var/lib/agenthq pnpm install:cron <automation-name>
AGENTHQ_HOME=/var/lib/agenthq pnpm list:cron
```

Remove a scheduled automation:

```bash
AGENTHQ_HOME=/var/lib/agenthq pnpm uninstall:cron <automation-name>
```

Cron logs are written under `$AGENTHQ_HOME/data/`, for example `/var/lib/agenthq/data/cron-<automation-name>.log`. The generated cron block preserves `AGENTHQ_HOME` from install time.

Install cron as the same Unix user that ran `pi /login`, so Pi can reuse its stored auth.

## 7. Install task dispatcher heartbeat

Projects and tasks live under `$AGENTHQ_HOME/projects`. The dispatcher assumes one local heartbeat process/timer and claims one `ready` assigned task per run by default:

```bash
cd /root/jumpygoat-hq
AGENTHQ_HOME=/var/lib/agenthq pnpm dispatch:tasks
```

Cron example, every five minutes:

```cron
*/5 * * * * cd /root/jumpygoat-hq && AGENTHQ_HOME=/var/lib/agenthq /root/.local/share/pi-node/current/bin/pnpm dispatch:tasks >> /var/lib/agenthq/data/task-dispatch.log 2>&1
```

For systemd timers, use the same `WorkingDirectory`, `EnvironmentFile`, `HOME`, `PATH`, and `AGENTHQ_HOME` pattern as the web service, with `ExecStart=<pnpm-path> dispatch:tasks`.

## 8. Updating an existing deployment

```bash
cd /root/jumpygoat-hq
git pull
pnpm install
AGENTHQ_HOME=/var/lib/agenthq pnpm setup:db
pnpm build
AGENTHQ_HOME=/var/lib/agenthq pnpm run doctor
systemctl restart agenthq-web
```

If automation schedules changed, reinstall the affected cron entries:

```bash
AGENTHQ_HOME=/var/lib/agenthq pnpm install:cron <automation-name>
AGENTHQ_HOME=/var/lib/agenthq pnpm list:cron
```

## Notes

- Runtime and personal instance state is intentionally outside source when `AGENTHQ_HOME` is set: `$AGENTHQ_HOME/{agents,automations,projects,data,workspaces,traces}` and optional `$AGENTHQ_HOME/settings.yml`. Local development uses gitignored `workspace/{agents,automations,projects,data,workspaces,traces}` plus `workspace/settings.yml` by default.
- Keep `HOST=127.0.0.1` unless the service is behind trusted auth/proxy/firewall.
- For a non-root deployment, replace `User=`, `WorkingDirectory=`, `EnvironmentFile=`, `HOME=`, and the executable paths with that user’s values.
