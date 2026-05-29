# Cloudflare R2 artifact connector

The R2 artifact connector lets an agent upload a generated file during a run and receive an expiring secret download URL. Use it for PDFs, reports, exports, screenshots, and other automation outputs that should be shared without syncing to Dropbox/Drive/Notion first.

## Tools

| Intent | Tool | What it does |
| --- | --- | --- |
| `artifact.upload` | `artifact_upload` | Uploads a file to Cloudflare R2 and returns a presigned download URL. |

Artifacts are the jumpyGoatHq primitive. Cloudflare R2 is the v1 storage/share connector.

```text
Pi agent -> generated file -> artifact_upload -> R2 object -> 7-day signed URL -> email/webhook/etc.
```

## 1. Create R2 credentials

In Cloudflare:

1. Create an R2 bucket.
2. Create an R2 API token/access key with object read/write access to that bucket.
3. Copy the account id, access key id, secret access key, and bucket name.

## 2. Add local secrets/defaults

Create or update `.env.local`:

```env
CLOUDFLARE_R2_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
CLOUDFLARE_R2_BUCKET=automation-artifacts

# Optional defaults:
JUMPYGOATHQ_ARTIFACT_EXPIRES_SECONDS=604800
JUMPYGOATHQ_ARTIFACT_MAX_FILE_BYTES=25000000
JUMPYGOATHQ_ARTIFACT_UPLOAD_TIMEOUT_MS=60000
```

Make the same env vars available to cron/deployment if scheduled automations will upload artifacts. Do not put R2 secrets in agent or automation markdown.

## 3. Enable the intent on the agent

`agents/report-agent/AGENT.md`:

```yaml
---
name: report-agent
allowedIntents:
  - artifact.upload
  - mail.send
artifacts:
  upload:
    enabled: true
    connector: r2
    expiresInSeconds: 604800
    maxFileBytes: 25000000
mail:
  send:
    enabled: true
    connector: agentmail
    inboxId: reports@agentmail.to
---
```

In the agent instructions, tell Pi when to upload files and how to use the returned URL.

## 4. Optionally override per automation

`automations/monthly-report.md`:

```yaml
---
agent: report-agent
schedule: manual
artifacts:
  upload:
    expiresInSeconds: 604800
    maxFileBytes: 50000000
---

Create `output/report.pdf`, upload it with artifact_upload, then email the returned URL.
```

## Tool call

```json
{
  "path": "output/report.pdf",
  "filename": "report.pdf",
  "contentType": "application/pdf"
}
```

The file path must be relative and must resolve inside either the run working directory or the active agent folder. Absolute paths, `..`, backslashes, null bytes, and symlink escapes are rejected.

## Storage and links

Objects are private by default and stored with deterministic keys:

```text
runs/<runId>/<safe-filename>
```

The returned URL is a Cloudflare R2 presigned `GET` URL. Anyone with the URL can download until it expires. V1 does not support one-time downloads or long-lived public URLs.

## Validate

```bash
pnpm run doctor
pnpm --filter @jumpygoat-hq/runner test:connectors
```

Doctor warns on partial R2 config but does not fail when R2 is absent. Missing R2 config becomes a tool error only when an enabled run calls `artifact_upload`.

For future implementation/fix context, load [`r2-artifacts-context.md`](r2-artifacts-context.md).
