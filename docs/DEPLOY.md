# Deploy agenthq on your own server

This guide runs the agenthq web UI as a `systemd` service and installs scheduled automations with cron.

agenthq currently has no built-in auth. Keep the web UI bound to `127.0.0.1` and use an SSH tunnel, Tailscale, or a trusted authenticated reverse proxy.

## Assumptions

Examples below use:

- repo path: `/root/jumpygoat-hq`
- Unix user: `root`
- web address on the server: `127.0.0.1:3000`

Adjust paths/usernames if you deploy under a different user such as `agenthq`.

## 1. Prepare the server checkout

SSH to the server as the user that will run agenthq, then install dependencies, initialize SQLite, and build:

```bash
cd /root/jumpygoat-hq

pnpm install
pnpm setup:db
pnpm build
pnpm run doctor
```

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

The public repo ships with no active automations. Create your local `skills/<name>/SKILL.md` and `automations/<name>.md` first, then install scheduled automation runs separately into cron:

```bash
cd /root/jumpygoat-hq
pnpm install:cron <automation-name>
pnpm list:cron
```

Remove a scheduled automation:

```bash
pnpm uninstall:cron <automation-name>
```

Cron logs are written under `data/`, for example `data/cron-<automation-name>.log`.

Install cron as the same Unix user that ran `pi /login`, so Pi can reuse its stored auth.

## 7. Updating an existing deployment

```bash
cd /root/jumpygoat-hq
git pull
pnpm install
pnpm setup:db
pnpm build
pnpm run doctor
systemctl restart agenthq-web
```

If automation schedules changed, reinstall the affected cron entries:

```bash
pnpm install:cron <automation-name>
pnpm list:cron
```

## Notes

- Runtime and personal instance state is intentionally local and gitignored: `.env.local`, `data/`, `workspaces/`, active `skills/*`, and active `automations/*.md`.
- Keep `HOST=127.0.0.1` unless the service is behind trusted auth/proxy/firewall.
- For a non-root deployment, replace `User=`, `WorkingDirectory=`, `EnvironmentFile=`, `HOME=`, and the executable paths with that user’s values.
