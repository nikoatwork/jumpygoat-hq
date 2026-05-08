# Research Findings

> **Current reframe:** the goal is now **personal scheduled Pi skills**, not a deterministic workflow builder. The primitive to test is: `automation.md` → cron/systemd → Pi headless run → JSONL trace. Pi is the agent harness. The Activepieces/Dify/n8n workflow-builder research below is kept for contrast/reference, but it is **not** the current direction.

> Previous reframe (superseded): the goal was *business automations* with `cron → deterministic pipeline → LLM as a node`. That is now intentionally rejected in favor of skill-like agent freedom.

---

# Part 2 — Scheduled-workflow engines (current target)

**What I actually want:**
- Nocode, opinionated visual builder (not a Trigger.dev-style SDK)
- LLM is one step among many, not the decider
- Scheduled/cron triggers first-class
- Tools available to workflow steps: local fs, MCP, shell/CLI
- Self-host on a VPS, minimal moving parts
- Dashboard showing which workflows are scheduled, what ran, outputs, cost

### Top picks (best → worst fit)

#### 1. Activepieces — best match
https://github.com/activepieces/activepieces — MIT, self-host, Node/TS.

- **Opinionated "Pieces" model.** 280+ pieces; each piece is both a workflow node *and* exposable as an MCP tool.
- **Activepieces MCP server** is GA and free on self-host — you can call any piece over MCP and vice versa (the LLM can call a piece as a tool).
- AI pieces (OpenAI, Anthropic, etc.) are explicitly "LLM step in a flow," not agent-routers.
- Scheduled triggers, webhooks, manual triggers — all first-class.
- Visual flow editor; typed data passing between steps.
- Single-container Docker self-host, Postgres + Redis.
- Not bloated by n8n standards — it's the newer, leaner take on the same shape.

Gaps vs. requirements:
- Local filesystem access from a workflow step isn't default; you'd drop to a "Code" piece (Node) or shell out.
- Built-in cost tracking is thin — pair with Langfuse if that matters.

#### 2. Dify (Workflow mode — not Agent mode)
https://github.com/langgenius/dify — self-host, OSS with commercial clauses (check license fit).

- Dify has two modes: **Agent** (LLM decides) and **Workflow** (deterministic DAG). Use Workflow.
- **Schedule Trigger** node shipped in v1.10 (late 2025) — cron built in.
- Can consume MCP servers as tools in a step, and can expose a Dify app as an MCP server.
- Nocode canvas, opinionated.
- Good if your workflows are RAG-heavy; overkill if not.

Gaps:
- Heavier stack than Activepieces (Postgres + Redis + Weaviate/others by default).
- Less pure "automation" feel, more "AI app builder."

#### 3. Sim (sim.ai)
https://www.sim.ai/ — open source, Figma-style canvas, 1000+ integrations, YC-backed.

- Visual agent/workflow builder, cleaner UX than Dify.
- Newer and less proven; worth a serious look but don't bet the farm yet.

#### 4. n8n — honest mention
Despite the "bloated" read, n8n is the one tool in this list that's been battle-tested at scale, has the most integrations, has scheduled triggers, and has a real execution monitor UI. Its AI nodes let you wire an LLM as a step. If Activepieces feels rough after a day of use, fall back here rather than rolling your own.

### Not a fit (for this use case)
- **Mission Control / OpenClaw / ClawMetry** — designed for long-lived agent loops with channel inboxes. Wrong shape for "cron → pipeline."
- **Trigger.dev / Inngest / Windmill / Kestra** — dev-first, code or YAML. Fine platforms; violates the nocode requirement.
- **Motia** — backend framework, not a UI. Skip.
- **Langflow / Flowise** — LLM-as-router visual builders; drifts back toward the agent shape you're avoiding.
- **Huginn** — nocode and scheduled, but predates LLMs and the AI story is weak.

### Revised recommended stack
1. **Activepieces** self-hosted on the VPS (Docker compose) — workflow engine + scheduler + MCP bridge.
2. **Langfuse** self-hosted — trace + cost visibility across whatever LLM calls happen inside workflows.
3. That's it. No OpenClaw, no Mission Control, no agent runtime layer.

### Validation steps before committing
1. Build one real workflow in Activepieces: **cron → fetch data → LLM summarize step → write file / send Slack**. Verify the LLM step reads a local file via a piece (not agent loop).
2. Try the MCP piece — call a filesystem-MCP server from inside a workflow step.
3. Check execution history UI: is it enough to answer "what ran today and how much did it cost," or do I need Langfuse from day one?
4. If (1) or (2) is painful → repeat the test in Dify Workflow mode. If still painful → n8n.

---

# Part 1 — Original research (chat-assistant shape, kept for reference)

**Goal:** deploy a service on a VPS that lets me define agents, run them on crons, monitor what's live / what executed / cost, and poke at them via CLI (Slack nice-to-have).

**TL;DR recommendation (2026-04-24):**
- If I want the **closest thing to "n8n of agents" today** → **Mission Control** (builderz-labs/mission-control). Single-command install, SQLite, dashboard with task board + agent fleet + cost + natural-language cron + MCP audit. MIT. ~4.3k ⭐.
- If I want **one agent I own, talkable over Slack/Discord/WhatsApp, with cron + cost tracking** → **OpenClaw** + **ClawMetry** for the dashboard. Pi (`pi-agent-core`) is its runtime core.
- If I want **multi-user sessions on a shared VPS** (like a team instance) → **AgentClaw** (OpenClaw + FastAPI + React + per-user Docker sandboxes). Still small (~39 ⭐), evaluate carefully.
- If "n8n with AI nodes" is good enough → just run **n8n** or **Activepieces**. Both are mature and have real workflow monitoring, just less "agent-native."

---

## 1. Pi — the agent core that OpenClaw is built on

**What it is:** Pi is Mario Zechner's minimal coding agent. Core monorepo lives at `badlogic/pi-mono`. The runtime library is published as `@mariozechner/pi-agent-core`.

- **Primitives:** 4 tools (Read, Write, Edit, Bash), branchable tree-structured sessions, multi-provider messages in one session (Anthropic / OpenAI / Google / local), hot reload.
- **Not a platform.** It's a library you build *on top of*. No UI, no cron, no multi-user, no monitoring.
- **Design philosophy:** tiny core + extensions. The extension system is how features like `/todos`, `/review`, sub-agents get added.

**Refs:**
- https://lucumr.pocoo.org/2026/1/31/pi/ (Armin Ronacher, "Pi: The Minimal Agent Within OpenClaw")
- https://github.com/badlogic/pi-mono
- https://gist.github.com/dabit3/e97dbfe71298b1df4d36542aceb5f158 (Nader Dabit, how Pi's packages fit together)

---

## 2. OpenClaw — Pi wrapped into a personal assistant

**Repo:** https://github.com/openclaw/openclaw — TypeScript/Node.js, MIT.

### Architecture
Hub-and-spoke. A single **Gateway** (WebSocket, `127.0.0.1:18789` by default) coordinates:
- **Channel adapters**: WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Teams.
- **Control interfaces**: Web UI, CLI, macOS menu-bar app, mobile nodes.
- **Agent runtime**: Pi Agent Core, RPC-style, streaming.

Sessions are append-only logs under `~/.openclaw/sessions/`. Memory lives in SQLite per agent with hybrid vector + BM25 search.

### Agent definition
Workspace folder `~/.openclaw/workspace/` with a composable prompt layout:
- `AGENTS.md` — global instructions
- `SOUL.md` — personality
- `TOOLS.md` — user tool conventions
- `skills/<skill>/SKILL.md` — task playbooks, selectively injected per turn
- `MEMORY.md` + `memory/YYYY-MM-DD.md` — long-term memory

Multi-agent routing via `agents.mapping` in config — e.g. route `group:discord:123` to a dedicated workspace + model.

### What it ships with
- ✅ Cron jobs / scheduled actions + webhooks
- ✅ Cost tracking (`/usage off|tokens|full`)
- ✅ CLI (`openclaw agent`, `openclaw message send`, …)
- ✅ Slack/Discord/WhatsApp/Telegram/Signal/iMessage channel adapters
- ✅ Docker sandbox for DM/group sessions (prompt injection defense)
- ✅ VPS deploy patterns documented: systemd + SSH tunnel or Tailscale Serve; Fly.io Docker pattern with persistent volume
- ❌ **Single-user by design.** Multi-user needs a layer on top.

### Install
```
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

**Refs:**
- https://github.com/openclaw/openclaw
- https://ppaolo.substack.com/p/openclaw-system-architecture-overview (solid architecture explainer)
- https://github.com/mergisi/awesome-openclaw-agents (199 ready-made SOUL.md templates)

---

## 3. Multi-user / multi-agent layers on OpenClaw

### AgentClaw — closest to "shared VPS instance"
https://github.com/wuding129/agentClaw — MIT, ~39 ⭐ (small, young).

- FastAPI + PostgreSQL backend, TypeScript bridge, React + Vite frontend, Docker Compose deploy.
- Per-user Docker sandboxes, workspace path `~/.openclaw/workspace-{agentId}/`.
- JWT auth, LLM API key proxying, shared skills registry.
- "Zero-intrusion" — does not fork OpenClaw source.
- Demo: https://agent.428916.xyz
- ⚠ No cron / cost tracking mentioned in README — inherits whatever the embedded OpenClaw version supports, but UI surface for those features is not documented.

### ClawTeam — agent swarm coordination
https://github.com/win4r/ClawTeam-OpenClaw — MIT, Python 3.10+.

- "You set the goal. The swarm splits it, spawns workers, merges results."
- Agents run in isolated git worktrees (no merge conflicts during parallel work).
- State = JSON files in `~/.clawteam/` with atomic locking. No database.
- Backends: tmux (Linux/macOS), subprocess (Windows), P2P via ZeroMQ.
- **Dashboards:** terminal kanban (`board show`), web UI (`board serve`), tmux tiled view (`board attach`), **cost tracking per agent + model**.
- Supports OpenClaw (default), Claude Code, Codex, Cursor, Hermes, nanobot.
- Best fit if I want a small team of agents coordinating on a single goal, not "many long-lived agents."

---

## 4. Observability for OpenClaw

### ClawMetry
- `pip install clawmetry`, zero-config.
- Tracks token spend per session, sub-agent activity, **cron job execution**, memory state changes, full searchable session logs, live flow visualization / replay.
- Free for self-host; cloud tier is $5/node/month.
- ⚠ Couldn't find a canonical repo link in the post — verify before relying on it.
- Ref: https://simen.ai/blog/openclaw-agent-observability-how-to-finally-see-what-your-ai-is-actually-doing

### Langfuse (generic, battle-tested)
- https://langfuse.com/pricing-self-host — MIT, self-host is free and unrestricted, ~19k ⭐.
- Traces, agent graphs, cost, evals, datasets. Integrates via SDK from whatever agent framework.
- Right pick if I want observability that will outlive any specific agent runtime I choose.

---

## 5. Mission Control — the actual "n8n for agents" match

https://github.com/builderz-labs/mission-control — MIT, ~4.3k ⭐, active.

Stack: Next.js 16 + React 19 + TypeScript + SQLite (better-sqlite3), WebSocket + SSE for live updates, Recharts for graphs.

Features that line up with my requirements:
- **Agent fleet management**: register via REST API, poll task queue, heartbeat, auto-discovery from local filesystem.
- **Task board**: Kanban, drag-drop, priority, multi-project.
- **Natural language scheduling**: "every morning at 9am" → cron template that spawns dated child tasks.
- **Cost tracking**: per-model token use, trend charts.
- **Skills hub**: install from registries, built-in security scan.
- **Security audit**: trust score, secret detection, MCP call auditing.
- **CLI integration**: Claude Code, Codex, or any headless tool.
- **Webhooks out** with retry + HMAC.
- **Install:** `bash install.sh --local`. No Redis/Postgres. Docker hardened profile optional.

This is the single best match for what I described. Pairs naturally with OpenClaw as the *runtime* under it — Mission Control for "fleet-and-scheduling dashboard," OpenClaw for "the agent itself."

---

## 6. Alternatives that compete for the same job

### Pure workflow (not agent-native, but mature)
| Tool | Stack | Self-host | Cron | Monitoring | Notes |
|---|---|---|---|---|---|
| **n8n** | Node.js | ✅ MIT-ish (fair-code) | ✅ first-class | ✅ exec logs | Baseline. Huge integration library. AI Starter Kit bundles Ollama + Qdrant + n8n. Weak on cost tracking out of the box. |
| **Activepieces** | TS | ✅ MIT | ✅ | ✅ | Cleaner UX than n8n, AI-agent "pieces," growing fast. |
| **Windmill** | Rust+TS | ✅ AGPL | ✅ | ✅ + workers dashboard | More of a "code-first internal tools + jobs" platform. Powerful but bigger surface area. |

### Low-code agent builders
| Tool | Stack | Self-host | Strength | Weakness |
|---|---|---|---|---|
| **Dify** | Python | ✅ | Polished chat + agent UI, RAG first-class | Opinionated; less good for long-running background agents |
| **Langflow** | Python | ✅ | Visual LangChain graphs | Brittle at scale; heavy |
| **Flowise** | Node | ✅ | Visual builder, quick to prototype | Thin on ops/monitoring |

### Durable execution / job runners (for the "scheduled agents" job)
| Tool | Self-host | Notes |
|---|---|---|
| **Inngest** | OSS dev server; cloud for prod | Great DX, durable steps, retries. Self-host story is weaker than Trigger. |
| **Trigger.dev v4** | ✅ self-host | Durable tasks, runs long LLM jobs, good UI, Postgres-heavy. |
| **Windmill** | ✅ | Scripts + flows + cron + workers in one. Closest "n8n alternative." |

These are the right substrate if I want to **build my own** agent platform rather than adopt one. Not themselves "n8n for agents."

---

## 7. Decision grid against my requirements

| Requirement | Mission Control | OpenClaw | OpenClaw + ClawMetry | AgentClaw | n8n / Activepieces |
|---|---|---|---|---|---|
| Define agents declaratively | ✅ (Skills + SOUL) | ✅ (AGENTS.md/SOUL.md/skills) | ✅ | ✅ | ⚠ (workflows, not agents) |
| See which agents are live | ✅ heartbeat | ⚠ basic | ✅ | ✅ | n/a |
| See running crons | ✅ | ✅ | ✅ | ⚠ | ✅ |
| Cost tracking in UI | ✅ | ⚠ CLI `/usage` | ✅ | ❌ | ❌ (needs Langfuse) |
| Execution history / replay | ✅ | ⚠ session logs | ✅ full replay | ⚠ | ✅ |
| Slack access to agents | via webhook | ✅ native | ✅ (inherits) | ⚠ | ✅ via node |
| CLI access | ✅ | ✅ | ✅ | ⚠ | ⚠ |
| VPS self-host in a day | ✅ single script | ✅ systemd or Fly | ✅ `pip install` | ⚠ Docker Compose | ✅ |
| Multi-user | ⚠ teams but single-tenant | ❌ | ❌ | ✅ | ✅ |

---

## 8. Concrete recommendation

For a VPS right now, the lowest-risk stack is:

1. **Mission Control** as the dashboard/fleet manager + scheduler (MIT, single-command install, SQLite, real UI, good docs).
2. **OpenClaw** as the agent runtime that Mission Control schedules/dispatches (MIT, Slack/Discord/WhatsApp adapters, cron, docker sandbox, Tailscale for remote).
3. **Langfuse** (self-hosted) for durable cost/trace observability that isn't tied to any one runtime — plug OpenClaw and any other agents into it.

Fallback if Mission Control turns out to be immature under real load: run OpenClaw alone + ClawMetry for dashboards and let that carry until I outgrow single-tenant.

Avoid unless you specifically need it:
- **AgentClaw** — promising but ~39 ⭐, not battle-tested.
- **ClawTeam** — solves a different problem (swarm collab), not "long-lived scheduled agents."
- **Langflow/Flowise** — prototyping, not ops.

---

## 9. Open questions to validate before committing

1. Does Mission Control's "agent" abstraction actually *run* agent loops, or does it just dispatch to external processes (Claude Code, Codex, OpenClaw)? — Docs suggest the latter. That's fine, but means I still need OpenClaw (or similar) under it.
2. ClawMetry repo/license — the blog post doesn't link the repo. Confirm it's really open source before depending on it.
3. Multi-user need: do I actually need it on day one, or is a single-tenant VPS instance with my own accounts fine? If single-tenant, skip AgentClaw and keep the stack simple.
4. LLM cost limits — Mission Control tracks cost but does it *enforce* budgets? If not, add a gateway (LiteLLM / Helicone) in front.

---

## Sources
- https://lucumr.pocoo.org/2026/1/31/pi/
- https://github.com/badlogic/pi-mono
- https://github.com/openclaw/openclaw
- https://ppaolo.substack.com/p/openclaw-system-architecture-overview
- https://github.com/mergisi/awesome-openclaw-agents
- https://github.com/wuding129/agentClaw
- https://github.com/win4r/ClawTeam-OpenClaw
- https://github.com/builderz-labs/mission-control
- https://simen.ai/blog/openclaw-agent-observability-how-to-finally-see-what-your-ai-is-actually-doing
- https://langfuse.com/pricing-self-host
- https://www.activepieces.com/blog/ai-workflow-automation-tools
- https://docs.n8n.io/hosting/starter-kits/ai-starter-kit/
- https://trigger.dev/, https://www.inngest.com/pricing, https://www.windmill.dev/pricing
