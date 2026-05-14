# Testing AgentHQ end-to-end

Tight loop for coding agents testing a real AgentHQ agent/automation locally.

## 1. Choose instance state

Default local state is gitignored and safe for ad hoc tests:

```bash
# default: AGENTHQ_HOME unset => ./workspace
```

For extra isolation:

```bash
export AGENTHQ_HOME=/tmp/agenthq-e2e-test
mkdir -p "$AGENTHQ_HOME"
```

Do not commit active `workspace/{agents,automations,projects,data,workspaces,traces}` files.

## 2. Start web UI

```bash
mkdir -p workspace/data
HOST=127.0.0.1 PORT=3000 pnpm web > workspace/data/web.log 2>&1 &
echo $! > workspace/data/web.pid
```

Open: <http://127.0.0.1:3000>

Stop when done:

```bash
if [ -f workspace/data/web.pid ]; then
  pid=$(cat workspace/data/web.pid)
  kill "$pid" 2>/dev/null || true
  rm -f workspace/data/web.pid
fi
```

## 3. Create test workspace content

Use the web UI or write files directly:

```txt
workspace/agents/<agent>/AGENT.md
workspace/agents/<agent>/context/*.md
workspace/automations/<automation>.md
workspace/projects/<project>/PROJECT.md
workspace/projects/<project>/tasks/<task-id>.md
```

For connector tests, ensure `.env.local` has required secrets, e.g. `FIRECRAWL_API_KEY`, `RESEND_API_KEY`, and `AGENTHQ_NOTIFY_EMAIL_FROM`.

## 4. Dry-check config before spending/sending

```bash
pnpm --filter @agenthq/runner exec tsx - <<'EOF'
import { loadDotEnv } from './src/env.js';
loadDotEnv();
const { loadAutomation } = await import('./src/automation.js');
const { loadAgent } = await import('./src/agent.js');
const { resolveConnectorPlan, connectorToolNames } = await import('./src/connectors/index.js');
const automation = await loadAutomation('<automation>');
const agent = await loadAgent(automation.agent);
const plan = resolveConnectorPlan({ automation, agent, runId: 'dry-run' });
console.log({ automation: automation.name, agent: agent.name, schedule: automation.schedule, tools: connectorToolNames(plan), to: plan.resend?.to, hasFrom: Boolean(plan.resend?.from) });
EOF
```

## 5. Run one automation or task dispatch

Automation:

```bash
pnpm runner <automation>
```

Task dispatcher:

```bash
pnpm dispatch:tasks
```

Do not install cron during tests unless explicitly requested.

## 6. Inspect results

Web:

```txt
/runs
/runs/<run-id>
/tasks
```

CLI summary:

```bash
pnpm --filter @agenthq/web exec tsx - <<'EOF'
import { listRuns } from './src/readers.js';
const run = listRuns(1)[0];
console.log(JSON.stringify({ id: run?.id, automation: run?.automation, agent: run?.agent, project: run?.project, task_id: run?.task_id, status: run?.status, exit_code: run?.exit_code, connector_actions_json: run?.connector_actions_json }, null, 2));
console.log('\nOUTPUT TAIL\n' + (run?.output_text || '').slice(-2000));
console.log('\nERROR TAIL\n' + (run?.error_text || '').slice(-2000));
EOF
```

Check generated workspace/state files under:

```txt
workspace/workspaces/<automation>/
workspace/data/agenthq.sqlite
```

## 7. Cleanup cost-bearing test artifacts

After any live connector/LLM/email test, ensure nothing keeps running automatically.

Stop the local web server:

```bash
if [ -f workspace/data/web.pid ]; then
  pid=$(cat workspace/data/web.pid)
  kill "$pid" 2>/dev/null || true
  rm -f workspace/data/web.pid
fi
lsof -iTCP:3000 -sTCP:LISTEN -n -P || true
```

Remove cron for the tested automation unless the user explicitly wants it active:

```bash
pnpm uninstall:cron <automation>
```

If unsure whether cron was installed, verify:

```bash
crontab -l 2>/dev/null | grep -n '<automation>\|agenthq:start\|agenthq:end' || true
```

Keep useful gitignored agent/automation/project files only when requested. Otherwise remove test fixtures under `workspace/agents/`, `workspace/automations/`, `workspace/projects/`, and `workspace/workspaces/`.
