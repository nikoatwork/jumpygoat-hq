# vision

agenthq is the **smallest useful open-source agent operations layer**: a file-native, local-first control plane for Pi-powered agents.

The inspiration is the minimal useful slice of Hermes/OpenClaw-style infrastructure, not a feature clone. agenthq should have strong primitives, limited features, and clear extension seams.

```txt
agents as markdown → schedules/tasks/operator commands → Pi runs → auditable SQLite history
```

Pi is the harness. agenthq owns the product primitives around Pi: files, scheduling, task dispatch, connector gates, safe operator surfaces, and observability.

## The product primitive

An **agent** is the user-facing runtime entity.

An agent bundles:

- instructions/persona/context;
- optional scoped markdown context;
- default model/config;
- allowed intents/capabilities;
- connector/tool policy.

An **automation** or **task** runs an agent with a prompt.

Example target shape:

```markdown
---
agent: daily-review
schedule: "manual"
model: anthropic/claude-sonnet-4-5
---

Review the workspace notes and open issues. Tell me what needs attention today.
```

Edit the file → edit the behavior. Files remain the source of truth.

## What this is

- Minimal open-source control plane for agents.
- Local-first/self-hostable runtime.
- File-backed agents, automations, projects, and tasks.
- Shared SQLite run history for auditability.
- Raw HTML operator UI until richer UI is clearly needed.
- Connector/domain tool system for safe extensibility.

## What this is not

- Not a workflow builder: no DAGs, nodes, or deterministic pipeline UI.
- Not a broad Hermes/OpenClaw clone.
- Not a general personal assistant platform.
- Not a hosted SaaS or multi-user RBAC product for the first release.
- Not a custom LLM/tool loop.
- Not a generic repo-coding chat surface.

## The bet

A small set of strong primitives can replace a meaningful slice of recurring operational work:

> a capable agent harness + a file-defined agent + scheduled/assigned work + auditable runs + gated extensions

The agent decides the steps. Pi provides the loop/tools. agenthq provides the durable product surface around it.

## Extensibility stance

Open-source extensibility matters more than feature breadth.

Good extensions should be able to add:

- a connector/tool;
- a channel adapter;
- a task source;
- a schedule/dispatch adapter;
- a focused UI view;
- an agent/context template.

They should not require understanding a large platform or modifying core runtime internals.

## User model for first release

Single-operator first:

- operator = admin = user;
- local/private by default;
- no public SaaS assumptions;
- no team auth/RBAC until needed;
- breaking changes are acceptable before release if they clarify primitives.

## Near-term sequence

1. Replace skill-facing concepts with **agents**.
2. Keep automations as file-backed scheduled/manual agent runs.
3. Add safe domain services/path policy for all mutations.
4. Add file-backed projects/tasks and a heartbeat dispatcher.
5. Add read-only schedule observability.
6. Add browser/Slack gateway adapters through domain-only tools.
7. Harden deployment once primitives stabilize.

## When to stop

Stop adding features when they make agenthq feel like a platform clone. The goal is a minimal extensible core with excellent observability, not breadth.
