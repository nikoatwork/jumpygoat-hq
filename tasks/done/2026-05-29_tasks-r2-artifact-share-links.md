# R2 Artifact Share Links

## Completion Summary

Completed 2026-05-29. Added the gated Cloudflare R2 artifact connector (`artifact.upload` / `artifact_upload`) with safe run/agent file reads, deterministic run-scoped keys, seven-day presigned URLs, audit summaries, setup docs, doctor diagnostics, tests, and validation.

## Goal

Add an agent-first artifact primitive backed by a gated Cloudflare R2 connector tool. Automations should be able to upload generated files during a Pi run, receive an expiring secret download URL, and include that URL in later actions like email, webhooks, Slack, Notion, or audit output.

## Notes

- Architecture decision: artifacts are the product primitive; Cloudflare R2 is the first storage/share provider.
- Connector decision: implement this like email/AgentMail/Firecrawl as an in-run Pi tool so the agent can observe upload success/failure before completing.
- Scope decision: ship only Cloudflare R2, not a multi-provider artifact interface in this task.
- Tool decision: expose one tool, `artifact_upload`; do not split upload/share for v1.
- Intent decision: add provider-neutral `artifact.upload`; frontmatter enables `artifacts.upload` with `connector: r2`.
- Read boundary: allow safe relative file reads from the run working directory and active agent-owned folders; reject absolute paths, `..`, and symlink escapes.
- Object keys: deterministic, run-scoped R2 keys such as `runs/<runId>/<safe-filename>`.
- Link expiry: default seven days; allow safe non-secret override up to the provider-supported maximum if needed.
- Secret-link protection: R2 presigned GET URLs are enough for v1; one-time download is intentionally out of scope.
- Docs requirement: include normal connector docs plus a very short <=50-line context/setup file future implementers can load directly.

## Architecture diagram

```text
Before:
Automation run -> Pi agent -> generated file -> email attachment/action

After:
Automation run -> Pi agent -> generated file
                         | calls artifact_upload
                         v
                 R2 connector tool
                         | uploads runs/<runId>/<file>
                         | returns expiring signed URL
                         v
              artifact result available in-run
                         |
                         +-> email/webhook/Slack/Notion can send/store the URL
                         +-> run trace stores compact artifact audit summary
```

## Relevant Files

- `packages/runner/src/connectors/types.ts` - Add `artifact.upload`, `artifact_upload`, R2 provider/config, and artifact audit fields.
- `packages/runner/src/automation.ts` - Parse `artifacts.upload` frontmatter from agents/automations.
- `packages/runner/src/connectors/resolve.ts` - Gate artifact upload with `allowedIntents` plus enabled config.
- `packages/runner/src/connectors/pi-extension.ts` - Register `artifact_upload` only when resolved for the run.
- `packages/runner/src/connectors/trace.ts` - Attribute artifact upload summaries into `connector_actions_json`.
- `packages/runner/src/connectors/artifacts/` - New R2 artifact connector implementation with local barrel exports.
- `packages/runner/test/connectors.test.ts` - Add R2 config/gating/path/presign/upload tests with mocked S3 client or HTTP layer.
- `scripts/doctor.ts` - Add optional non-failing R2 config diagnostics.
- `.env.example` - Document R2 env vars and seven-day expiry default.
- `docs/connectors/README.md` - Add artifact/R2 connector to the connector catalog.
- `docs/connectors/r2-artifacts.md` - Full setup and usage guide for Cloudflare R2 artifact links.
- `docs/connectors/r2-artifacts-context.md` - <=50-line context file with env vars, config shape, and implementation rules.
- `docs/examples/pdf-r2-artifact-agent.md` - PDF report artifact flow example using `artifact_upload` and mail.
- `workspace/agents/README.md` - Document `artifact.upload` in `allowedIntents` and agent default config.
- `workspace/automations/README.md` - Document per-run artifact config overrides.
- `packages/runner/src/connectors/DOCS.md` - Update connector contract and intent/tool table.
- `tasks/CHANGELOG.md` - Add dated completion summary when finished.

## Proposed config shape

```yaml
allowedIntents:
  - artifact.upload

artifacts:
  upload:
    enabled: true
    connector: r2
    expiresInSeconds: 604800 # 7 days
    maxFileBytes: 25000000
```

Tool call shape:

```json
{
  "path": "output/report.pdf",
  "filename": "report.pdf",
  "contentType": "application/pdf"
}
```

Expected tool result:

```json
{
  "key": "runs/run_abc/report.pdf",
  "url": "https://...presigned...",
  "expiresAt": "2026-06-05T12:00:00Z",
  "bytes": 123456,
  "contentType": "application/pdf"
}
```

## Progress

- 2026-05-29: Implemented `artifact.upload` / `artifact_upload` as a gated Cloudflare R2 connector with deterministic run-scoped keys, seven-day presigned URLs, path/symlink safety, compact audit summaries, docs, doctor diagnostics, and connector tests. Validation passed: `pnpm --filter @jumpygoat-hq/runner test:connectors`, `pnpm build`, `pnpm run doctor`, `pnpm validate:web`, `pnpm validate:backend`.

## Tasks

- [x] 1.0 Define artifact/R2 connector contract
  - [x] 1.1 Add final intent/tool/provider naming: `artifact.upload`, `artifact_upload`, `r2`.
  - [x] 1.2 Define tool params: safe file path, optional filename, optional content type.
  - [x] 1.3 Define path safety rules for run workspace and agent-owned folders.
  - [x] 1.4 Define deterministic object key rules under `runs/<runId>/`.
  - [x] 1.5 Define expiry rules: seven-day default, bounded override, explicit `expiresAt` in result.
  - [x] 1.6 Define compact audit summary fields: key, filename, bytes, content type, expiry, duration, status, error.

- [x] 2.0 Add schema, env, and connector-plan support
  - [x] 2.1 Extend connector intent/tool/provider types and maps.
  - [x] 2.2 Add `artifacts.upload` parsing from agent defaults and automation overrides.
  - [x] 2.3 Update connector resolution to require both `allowedIntents` and enabled config.
  - [x] 2.4 Pass non-secret R2 artifact config into `JUMPYGOATHQ_CONNECTORS_CONFIG_JSON`.
  - [x] 2.5 Read R2 secrets from env only: account id, access key id, secret access key, bucket.
  - [x] 2.6 Ensure no API keys or presigned URL internals are written into markdown config.

- [x] 3.0 Implement the Cloudflare R2 artifact connector
  - [x] 3.1 Add `packages/runner/src/connectors/artifacts/index.ts` and implementation files.
  - [x] 3.2 Create an S3-compatible R2 client using Cloudflare endpoint and env credentials.
  - [x] 3.3 Validate and resolve the requested file path within allowed roots.
  - [x] 3.4 Detect or accept content type and enforce max file size.
  - [x] 3.5 Upload to deterministic run-scoped key with safe filename normalization.
  - [x] 3.6 Generate a presigned GET URL with the configured/default seven-day expiry.
  - [x] 3.7 Return a Pi-friendly success/error result with compact `connectorSummary` details.

- [x] 4.0 Register, trace, and preserve run behavior
  - [x] 4.1 Register `artifact_upload` in `pi-extension.ts` only when enabled.
  - [x] 4.2 Add prompt snippet/guidelines telling Pi when to use artifact upload and how to report links.
  - [x] 4.3 Update trace extraction so artifact upload records persist to `connector_actions_json`.
  - [x] 4.4 Ensure behavior is unchanged when no artifact connector is enabled.
  - [x] 4.5 Ensure failed uploads are visible to Pi and in run trace without leaking secrets.

- [x] 5.0 Add tests and validation coverage
  - [x] 5.1 Test gating: disabled config, missing intent, valid enabled config.
  - [x] 5.2 Test path safety: absolute path, `..`, symlink escape, missing file, allowed agent-owned file.
  - [x] 5.3 Test deterministic key generation and filename sanitization.
  - [x] 5.4 Test missing/partial R2 env returns a readable tool error.
  - [x] 5.5 Test upload + presigned URL success using mocked S3/R2 client behavior.
  - [x] 5.6 Test max file size and content type handling.
  - [x] 5.7 Run `pnpm --filter @jumpygoat-hq/runner test:connectors`.
  - [x] 5.8 Run `pnpm build`.
  - [x] 5.9 Run `pnpm validate:web` after docs/API-visible changes.
  - [x] 5.10 Run `pnpm validate:backend` if local Pi auth/provider availability is expected.

- [x] 6.0 Document setup and future reimplementation context
  - [x] 6.1 Add `.env.example` entries for Cloudflare R2 account id, access key id, secret access key, bucket, and optional expiry/max size defaults.
  - [x] 6.2 Add `docs/connectors/r2-artifacts.md` with bucket/API-token setup, env vars, agent config, automation override, tool usage, and validation steps.
  - [x] 6.3 Add `docs/connectors/r2-artifacts-context.md` as a <=50-line context file future agents can load before implementing/fixing R2 artifacts.
  - [x] 6.4 Update `docs/connectors/README.md` connector catalog.
  - [x] 6.5 Update `packages/runner/src/connectors/DOCS.md` intent/tool table and connector-adding checklist.
  - [x] 6.6 Update `workspace/agents/README.md` with `artifact.upload` examples.
  - [x] 6.7 Update `workspace/automations/README.md` with per-run artifact upload overrides.
  - [x] 6.8 Add optional non-failing `pnpm run doctor` diagnostics for R2 config completeness.

- [x] 7.0 Prove the PDF-report use case
  - [x] 7.1 Add a docs example where an agent creates or receives `output/report.pdf`.
  - [x] 7.2 Show the agent calling `artifact_upload` and then `mail_send`/`notify_email` with the returned URL.
  - [x] 7.3 Confirm run detail/audit output shows upload status without storing large file contents.
  - [x] 7.4 Document that one-time download and long-lived public URLs are out of scope for v1.

- [x] 8.0 Close out
  - [x] 8.1 Update `tasks/CHANGELOG.md` with completed summary and validation results.
  - [x] 8.2 Move this task file to `tasks/done/YYYY-MM-DD_tasks-r2-artifact-share-links.md` when complete.
