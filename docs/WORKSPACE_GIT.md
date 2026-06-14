# Version a jumpyGoatHq workspace with private Git

This guide shows how to keep agents, automations, boards, and non-secret settings in a private Git repository while running jumpyGoatHq from the public app repository.

Use this when you want to work on the same jumpyGoatHq workspace from a laptop and a VPS without committing private agents or automations to the public `jumpygoat-hq` repo.

## Recommended shape

Keep two repositories:

```txt
~/dev/jumpygoat-hq/                 # public app/runtime repo
~/jumpygoathq-workspace-private/    # private workspace repo
  agents/
  automations/
  boards/
  settings.yml
  .gitignore
```

Then point jumpyGoatHq at the private workspace repo:

```env
JUMPYGOATHQ_HOME=/absolute/path/to/jumpygoathq-workspace-private
```

The commands are the same on a VPS and local machine; only the absolute paths differ.

## What to track

Track source-of-truth workspace content:

- `agents/<name>/AGENT.md`
- `agents/<name>/context/*.md`
- `agents/<name>/scripts/*.ts`
- `automations/*.md` when they are safe to share across machines
- `boards/**` when you want task boards versioned
- `settings.yml` only if it contains no secrets

Do not track runtime or secrets:

- `.env`, `.env.local`
- `data/`, SQLite files, logs
- `workdirs/`, traces, run artifacts
- agent `state/` unless you explicitly want that state in Git

## Create the private workspace repo

Pick a path for the private workspace:

```bash
export JGH_APP="$HOME/dev/jumpygoat-hq"
export JGH_WORKSPACE="$HOME/jumpygoathq-workspace-private"
```

Create it:

```bash
mkdir -p "$JGH_WORKSPACE"/{agents,automations,boards}
cd "$JGH_WORKSPACE"
git init
```

Add a safe `.gitignore`:

```bash
cat > .gitignore <<'EOF'
.env
.env.local

# Runtime state
data/
traces/
workdirs/
# legacy pre-workdirs runtime cwd root
workspaces/

# SQLite/run artifacts
*.sqlite
*.sqlite-shm
*.sqlite-wal
*.log

# Agent-private mutable state
agents/*/state/
EOF
```

Commit the empty workspace shell:

```bash
git add .gitignore agents automations boards
git commit -m "Initialize jumpyGoatHq private workspace"
```

Create a private GitHub repo, then add it as `origin`:

```bash
git remote add origin git@github.com:<owner>/<private-workspace-repo>.git
git branch -M main
git push -u origin main
```

## Point jumpyGoatHq at the private workspace

In the public app repo, keep local environment in `.env.local`:

```bash
cd "$JGH_APP"
cp -n .env.example .env.local
```

Add or update:

```bash
printf '\nJUMPYGOATHQ_HOME=%s\n' "$JGH_WORKSPACE" >> .env.local
```

Keep provider and connector secrets in this same app-local `.env.local`, or in the environment used by your process manager/cron:

```env
AGENTMAIL_API_KEY=...
AGENTMAIL_INBOX_ID=...
AGENTMAIL_TO=...
FIRECRAWL_API_KEY=...
```

Do not commit these secrets to the private workspace repo.

Initialize runtime folders and DB in the new workspace:

```bash
cd "$JGH_APP"
pnpm setup:db
pnpm doctor
```

## Move existing local workspace content

If you already have active agents/automations under the app repo's default `workspace/`, copy only source files into the private workspace:

```bash
cd "$JGH_APP"
rsync -a workspace/agents/ "$JGH_WORKSPACE/agents/"
rsync -a workspace/automations/ "$JGH_WORKSPACE/automations/"
rsync -a workspace/boards/ "$JGH_WORKSPACE/boards/" 2>/dev/null || true
[ -f workspace/settings.yml ] && cp workspace/settings.yml "$JGH_WORKSPACE/settings.yml"
```

Review before committing:

```bash
cd "$JGH_WORKSPACE"
git status
git diff -- . ':!data' ':!workdirs' ':!workspaces' ':!traces'
git add agents automations boards settings.yml .gitignore
git commit -m "Add workspace agents and automations"
git push
```

## Clone on another machine

On any other machine, including a VPS, clone both repos:

```bash
mkdir -p "$HOME/dev"
cd "$HOME/dev"
git clone https://github.com/<owner>/jumpygoat-hq.git
cd jumpygoat-hq
pnpm install
pnpm build
```

Clone the private workspace:

```bash
cd "$HOME"
git clone git@github.com:<owner>/<private-workspace-repo>.git jumpygoathq-workspace-private
```

Point the app at it:

```bash
cd "$HOME/dev/jumpygoat-hq"
cp -n .env.example .env.local
printf '\nJUMPYGOATHQ_HOME=%s\n' "$HOME/jumpygoathq-workspace-private" >> .env.local
# edit .env.local and add secrets for this machine
pnpm setup:db
pnpm doctor
```

Run an automation manually:

```bash
pnpm runner <automation-name>
```

## Cron and services

Cron/systemd must run with the same `JUMPYGOATHQ_HOME` and secrets.

If you install automation cron from the app repo after setting `.env.local`, jumpyGoatHq records the current workspace path in the cron command environment:

```bash
cd "$JGH_APP"
pnpm install:cron <automation-name>
pnpm list:cron
```

If you change `JUMPYGOATHQ_HOME` later, reinstall cron entries:

```bash
pnpm uninstall:cron <automation-name>
pnpm install:cron <automation-name>
```

For task dispatch cron:

```bash
pnpm uninstall:task-cron || true
pnpm install:task-cron
pnpm list:task-cron
```

For systemd or another process manager, set `JUMPYGOATHQ_HOME` in the service environment and keep secrets outside Git.

## Daily workflow

Before editing workspace files:

```bash
cd "$JGH_WORKSPACE"
git pull --ff-only
```

After editing agents, scripts, automations, or boards:

```bash
cd "$JGH_WORKSPACE"
git status
git diff
git add agents automations boards settings.yml
git commit -m "Update workspace"
git push
```

On the other machine:

```bash
cd "$JGH_WORKSPACE"
git pull --ff-only
```

## Handling machine-specific automations

Automations can be versioned, but be careful with machine-specific paths and recipients.

For example, this prompt input is machine-specific:

```json
{
  "projectDir": "/Users/monkey/dev/realestateagent"
}
```

On a VPS it might need to be:

```json
{
  "projectDir": "/home/agent/realestateagent"
}
```

Options:

1. Use the same absolute path on every machine, often via symlink.
2. Keep only an `.example` automation in Git and maintain the real automation locally.
3. Commit separate automation files per host, such as `real-estate-weekly-intent-vps.md` and `real-estate-weekly-intent-local.md`.

Prefer option 1 when you want identical scheduled behavior across machines; prefer option 2 when recipients, paths, or schedules are private to one host.

## Safety checklist

Before pushing the private workspace repo:

```bash
git status
git diff --cached
```

Check that the commit does not include:

- API keys or provider tokens
- private runtime traces
- SQLite databases
- cron logs
- accidental copies of the public app repo

The private workspace repo is for authored workspace state. Runtime state remains local to each machine.
