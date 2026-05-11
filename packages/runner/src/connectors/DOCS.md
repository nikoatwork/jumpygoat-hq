# Runner connector contract

Connectors are Pi extension tools assembled by the runner for one automation run. Pi must see connector results and failures while it reasons, so in-run tools are the default connector mode.

## Boundaries

- Public imports from outside this folder should target `packages/runner/src/connectors/index.ts`.
- Provider folders (`firecrawl/`, `resend/`) expose local `index.ts` barrels.
- Shared schemas/helpers live in `types.ts`, `resolve.ts`, `trace.ts`, and `legacy.ts`.
- `pi-extension.ts` is the static extension entrypoint passed to `pi --extension` only when gated tools are enabled.

## Gating

A connector tool is registered only when both gates pass:

1. Automation frontmatter enables the provider-backed intent.
2. The skill frontmatter `allowedIntents` includes the same provider-neutral intent.

Intent to tool mapping:

| Intent | Tool | Provider |
| --- | --- | --- |
| `web.search` | `web_search` | Firecrawl |
| `web.scrape` | `web_scrape` | Firecrawl |
| `web.crawl` | `web_crawl` | Firecrawl |
| `notify.email` | `notify_email` | Resend |

## Runtime config and secrets

The runner resolves a `ConnectorPlan`, serializes non-secret run/config values into `AGENTHQ_CONNECTORS_CONFIG_JSON`, and passes the static extension with `--extension`. Secrets stay in environment variables:

- `FIRECRAWL_API_KEY`
- `RESEND_API_KEY`
- optional notification defaults: `AGENTHQ_NOTIFY_EMAIL_TO`, `AGENTHQ_NOTIFY_EMAIL_FROM`, `AGENTHQ_NOTIFY_SUBJECT_PREFIX`

## Tool behavior

- Firecrawl tool output is bounded before returning to Pi.
- `web_crawl` uses a small async crawl with bounded polling and page/depth limits.
- `notify_email` sends immediately when Pi calls it; the gating and skill prompt are the confirmation layer.
- Missing API keys or required config throw tool errors so Pi can read and react to the failure.

## Connector action records

Connector summaries are stored in tool result `details.connectorSummary`. The runner also scans Pi JSON trace `tool_execution_start`/`tool_execution_end` events and persists compact records to `runs.connector_actions_json`. Records include successes and failures, but not large Firecrawl payloads.

Legacy fenced `agenthq-action` email blocks are still parsed after the run for migration compatibility. If `notify_email` was already called in-run, legacy email sending is skipped to reduce duplicate sends.

## Adding a connector

1. Add provider-neutral intent and Pi-safe tool name in `types.ts`.
2. Extend automation parsing and `resolveConnectorPlan` gating.
3. Add a provider folder with an `index.ts` barrel and a tool factory.
4. Register the new tool factory from `pi-extension.ts`.
5. Return bounded tool content and compact `connectorSummary` details.
6. Add mocked connector tests and update this doc plus automation/skill docs.
