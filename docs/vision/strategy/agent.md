# Agent strategy

## Status

This is the strategic north star for the pre-release product. The intended product model is agent-first. When there is a conflict, this file and `tasks/vision.md` describe the intended direction.

Breaking changes are acceptable until release. Prefer a clean primitive model over compatibility layers.

## Vision

agenthq should be the **smallest useful open-source agent operations layer**: the minimal version of Hermes/OpenClaw-style agent infrastructure, focused on strong primitives, limited features, and easy extension.

It is not trying to become a broad personal assistant, workflow builder, or hosted SaaS. It should be a small core that lets operators define agents as files, run them on schedules or queued tasks, inspect exactly what happened, and extend capabilities with safe connectors/tools.

```txt
Pi runtime + file-native agents + automations/tasks + run observability + connector/tool extensions
```

## Product sentence

agenthq is a minimal, open-source, file-native control plane for Pi-powered agents: define agents as markdown, run them on schedules or assigned tasks, inspect auditable runs, and extend behavior through gated connectors and domain tools.

## What we borrow from Hermes/OpenClaw

Borrow the useful infrastructure shape:

- a clear boundary between core app code and mutable user workspace;
- agent definitions as composable files;
- channel/chat adapters as optional edges around a shared gateway;
- session/task/run observability;
- extension points for tools/connectors;
- local-first/self-hostable operation.

Do **not** copy the breadth:

- no general personal-agent feature sprawl;
- no many-channel platform before the primitives work;
- no heavyweight memory system by default;
- no app-store/plugin marketplace before a tiny extension contract is proven;
- no multi-user SaaS/RBAC until there is a real release reason.

## Core primitives

Keep the boundary split small and durable:

```text
Agent bundle = identity, instructions, context, memory, reusable procedures
Connector/tool = governed external capability with secrets, schemas, side-effect policy, audit
Automation/task = invocation source for an agent
Run = audit record
```

Keep the primitive set small and durable:

| Primitive | Meaning |
|---|---|
| **Agent** | Directory-backed Pi-powered runtime persona/context/policy bundle with a required `AGENT.md` entrypoint. |
| **Automation** | A file-backed scheduled/manual run of an agent with a prompt. |
| **Project/task** | File-backed unit of assignable work for an agent. |
| **Run** | One auditable execution record in shared SQLite. |
| **Connector/tool** | Extension-owned capability exposed only through gates/policy. |
| **Gateway** | Optional browser/Slack/operator chat surface over safe domain operations. |

Pi's small-folder capability pattern is an important implementation influence: a compact directory can progressively disclose instructions, references, scripts, assets, and task-specific workflows. AgentHQ borrows that bundle shape through explicit AgentHQ contracts, not by exposing untyped Pi resources as the control-plane primitive.

AgentHQ agents are the stricter, operational version of that idea. An agent can grow richer than one markdown file over time: `AGENT.md` and `context/*.md` are loaded today; `references/`, `templates/`, `assets/`, `procedures/`, `scripts/`, and `memory/` are reserved until documented. AgentHQ owns lifecycle, policy, scheduling, task assignment, connector gates, workspace, and run audit around the bundle. Pi's generated-instruction flag remains an adapter detail for passing the bundle into Pi.

## Strategic guardrails

### Keep

- Pi as the harness; no custom LLM/tool loop unless Pi blocks the product.
- File-native source of truth under `workspace/` or `AGENTHQ_HOME`.
- Shared SQLite for run history/observability, not as the primary authoring database.
- Strong primitives over many features.
- Open-source extensibility: documented file contracts, connector contracts, and domain-service seams.
- Minimal local/private web UI until complexity proves otherwise.
- Gated external side effects through connector/domain policies.
- Single-operator/local-first assumptions for the first release.

### Avoid

- Workflow-builder/DAG semantics.
- Broad Hermes/OpenClaw clone scope.
- Public generic JSON API as the main product surface.
- Slack/browser sessions with repo-wide shell or filesystem access.
- Multi-user SaaS, RBAC, billing, hosted control plane, or team dashboards before release.
- Premature React, distributed queues, per-agent databases, durable chat persistence, or plugin marketplaces.
- Compatibility shims that preserve bad pre-release concepts at the cost of clear primitives.

## Open-source extensibility stance

Extensibility should be boring and inspectable:

- **Files first:** agents, automations, projects, and tasks are inspectable files with markdown/frontmatter entrypoints.
- **Small contracts:** document frontmatter schemas and allowed transitions instead of hiding behavior in UI state.
- **Domain services:** web routes, dispatcher, and chat tools should share validated read/write services.
- **Connector gates:** external actions require both agent capability and run/task/automation configuration; agent-local resources do not bypass connector policy.
- **No secrets in files:** secrets live in env or deployment secret stores.
- **Replaceable edges:** cron/systemd, browser, Slack, and connectors are adapters around the same core primitives.

The goal is for contributors to add one connector, one adapter, one task source, or one view without understanding a large platform.

## Key tradeoffs

### Minimal Hermes/OpenClaw vs feature clone

A clone would chase channels, memory, plugins, mobile/control surfaces, and rich session management. agenthq should instead ship the smallest slice that proves useful work can be assigned, run, observed, and extended.

Decision bias: build fewer features with clearer seams.

### Agent bundle vs untyped bundle flexibility

Untyped Pi resource bundles can include instructions, references, scripts, assets, SQLite files, and arbitrary setup guidance. That flexibility is useful for context injection, but too loose to be AgentHQ's operations primitive: it is hard to audit capabilities, schedule safely, assign tasks, own memory/state, or gate external side effects when any bundle can smuggle behavior through scripts and instructions.

Agents are the product primitive: a typed, policy-aware, runnable bundle. `AGENT.md` is the required entrypoint; optional context/resources/memory may grow around it only through explicit AgentHQ contracts. External service access belongs to org/instance connectors and run-scoped tools, not hidden local implementations.

Decision bias: accept breaking migration to `agent:` before release, while preserving the useful folder shape for future agent richness.

### File-backed tasks vs database queue

Markdown tasks preserve local inspectability and open-source hackability. A DB queue would help concurrent workers, but it adds platform machinery too early.

Decision bias: start with file-backed tasks and one local heartbeat dispatcher.

### Chat gateway now vs core primitives first

A chat gateway is important, especially for browser/Slack operation, but it can easily become a general repo-coding agent. That violates the product boundary.

Decision bias: build agent/domain/path-policy primitives first; expose chat only through safe domain tools.

### Raw HTML vs richer frontend

Raw HTML keeps the product small and auditable. React becomes justified only when interaction complexity demands it.

Decision bias: no frontend framework until agent/task/schedule workflows become genuinely client-heavy.

## Recommended sequencing

1. **Agent entity refactor**
   - `agents/<name>/AGENT.md` plus optional scoped context.
   - Automations reference `agent: <name>`.
   - Capabilities/defaults live on the agent.
   - Keep the folder shape open for explicit future resources such as assets, helper scripts, and memory, without making raw Pi resources a public primitive.

2. **Domain service/path-policy extraction**
   - One safe service layer for web, dispatcher, and future chat tools.
   - Mutation stays under `AGENTHQ_HOME`, not repo source.

3. **Project/task queue MVP**
   - File-backed projects/tasks.
   - Single local heartbeat dispatcher.
   - Task execution creates normal run rows.

4. **Schedule observability**
   - Read-only agenda/calendar over scheduled agent runs and installed cron evidence.

5. **Gateway adapters**
   - Browser `/pi` first.
   - Slack Socket Mode later, deny-by-default, domain-only tools.

6. **Deployment hardening**
   - systemd/timer templates and deployment docs after primitives settle.

## Release bar

Before calling this released, the docs and UI should consistently describe agents as the product entity. The product should feel like a small extensible agent operations core: agents are rich enough to become durable operational bundles, while connectors/tools remain the governed path to external side effects.
