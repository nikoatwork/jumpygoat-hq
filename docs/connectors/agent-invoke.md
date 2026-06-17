# Agent invocation connector (`agent.invoke`)

`agent.invoke` exposes one Pi tool, `agent_invoke`, for synchronously invoking another jumpyGoatHq agent during a parent run.

## Gates

Both gates are required:

1. Parent agent frontmatter includes `agent.invoke` in `allowedIntents`.
2. Parent agent config enables `agents.invoke` with `connector: jumpygoathq` and an explicit `allow` list.

```yaml
---
name: repo-strategy-orchestrator
allowedIntents:
  - agent.invoke
agents:
  invoke:
    enabled: true
    connector: jumpygoathq
    allow:
      - local-file-reviewer
      - git-diff-reviewer
    timeoutMs: 600000
    maxDepth: 1
    maxOutputChars: 12000
---
```

Automation frontmatter may narrow the parent agent's allowlist or runtime bounds, but cannot expand the agent-owned allowlist.

## Tool call

The parent Pi agent calls:

```json
{
  "agent": "git-diff-reviewer",
  "prompt": "Summarize the recent git diff and git log for strategic direction.",
  "model": "optional-child-model-override",
  "maxOutputChars": 12000
}
```

The tool creates a child jumpyGoatHq invocation, runs it through the normal runner/Pi path, waits for completion, and returns bounded text with the child run id, status, duration, output, and error tail when present.

## Permissions and lineage

- Child agents resolve their own `AGENT.md` defaults, model, and connector permissions.
- Child agents do **not** inherit parent connector permissions.
- Self-invocation is denied by default.
- `maxDepth` defaults to `1`; scope-one orchestration is parent → child.
- Child runs are normal rows in SQLite with `source_type = subagent`, `parent_run_id`, `root_run_id`, and `depth`.
- Parent run connector actions include the `agent.invoke` result summary for auditability.

## Failure semantics

Denied target agents, depth violations, missing target agents, malformed prompts, child failures, and timeouts return compact failed tool results so the parent agent can reason about the failure. Infrastructure errors are recorded in the child or parent run trace/error fields.
