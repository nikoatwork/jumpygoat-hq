# Runner connector contract

Connectors are Pi extension tools assembled by the runner for one automation or task invocation. Pi must see connector results and failures while it reasons, so in-run tools are the default connector mode.

jumpyGoatHq boundary: agent bundles own identity, instructions, context, and capability policy; connectors/tools own governed external capability. That means connectors are responsible for secrets, provider schemas, Pi-safe tool names, side-effect policy, bounded results, and connector audit records. Agent-local resources, procedures, or scripts must not become an ungated bypass for external services.

## Boundaries

- Public imports from outside this folder should target `packages/runner/src/connectors/index.ts`.
- Provider folders (`firecrawl/`, `resend/`, `agentmail/`, `script/`) expose local `index.ts` barrels.
- Shared schemas/helpers live in `types.ts`, `resolve.ts`, `trace.ts`, and `legacy.ts`.
- `pi-extension.ts` is the static extension entrypoint passed to `pi --extension` only when gated tools are enabled.

## Gating

A connector tool is registered only when both gates pass:

1. Agent defaults or invocation frontmatter enables the provider-backed intent.
2. The agent frontmatter `allowedIntents` includes the same provider-neutral intent.

Intent to tool mapping:

| Intent | Tool | Provider |
| --- | --- | --- |
| `web.search` | `web_search` | Firecrawl |
| `web.scrape` | `web_scrape` | Firecrawl |
| `web.crawl` | `web_crawl` | Firecrawl |
| `notify.email` | `notify_email` | Resend |
| `mail.send` | `mail_send` | AgentMail |
| `mail.list` | `mail_list` | AgentMail |
| `script.run` | `script_run` | Local Script |

## Runtime config and secrets

The runner resolves a `ConnectorPlan`, serializes non-secret run/config values into `JUMPYGOATHQ_CONNECTORS_CONFIG_JSON`, and passes the static extension with `--extension`. Secrets stay in environment variables:

- `FIRECRAWL_API_KEY`
- `RESEND_API_KEY`
- `AGENTMAIL_API_KEY`
- optional notification defaults: `JUMPYGOATHQ_NOTIFY_EMAIL_TO`, `JUMPYGOATHQ_NOTIFY_EMAIL_FROM`, `JUMPYGOATHQ_NOTIFY_SUBJECT_PREFIX`
- optional AgentMail defaults: `AGENTMAIL_INBOX_ID`, `AGENTMAIL_TO`, `AGENTMAIL_SUBJECT_PREFIX`

The local script connector has no provider API key; scripts run with `tsx` from the runner environment.

## Tool behavior

- Firecrawl tool output is bounded before returning to Pi.
- `web_crawl` uses a small async crawl with bounded polling and page/depth limits.
- `notify_email` sends immediately when Pi calls it; the gating and agent prompt are the confirmation layer.
- `mail_send` sends immediately from the configured AgentMail inbox; `mail_list` returns bounded recent inbox messages/previews.
- `script_run` runs an allowlisted `.ts`/`.tsx` file under the active agent's `scripts/` folder with JSON stdin, timeout, bounded stdout/stderr, symlink/path checks, and compact audit summaries. V1 does not enforce OS-level network/filesystem sandboxing; `network` and `write` are explicit policy/audit flags.
- Missing API keys or required config throw tool errors so Pi can read and react to the failure. Script connector failures return compact failed tool results so the trace still carries connector summary details.

## Connector action records

Connector summaries are stored in tool result `details.connectorSummary`. The runner also scans Pi JSON trace `tool_execution_start`/`tool_execution_end` events and persists compact records to `runs.connector_actions_json`. Records include successes and failures, but not large Firecrawl payloads.

Legacy fenced `jumpygoathq-action` email blocks are still parsed after the run for migration compatibility. If `notify_email` was already called in-run, legacy email sending is skipped to reduce duplicate sends.

## Adding a connector

1. Add provider-neutral intent and Pi-safe tool name in `types.ts`.
2. Extend agent/invocation parsing and `resolveConnectorPlan` gating.
3. Add a provider folder with an `index.ts` barrel and a tool factory.
4. Register the new tool factory from `pi-extension.ts`.
5. Keep credentials in environment/deployment secrets; never require secrets in markdown.
6. Return bounded tool content and compact `connectorSummary` details for audit.
7. Add mocked connector tests and update this doc plus automation/agent docs.
