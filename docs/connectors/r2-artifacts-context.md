# R2 artifact connector context

- Product primitive: automations produce artifacts; R2 is the v1 storage/share connector.
- Intent: `artifact.upload`; Pi tool: `artifact_upload`; provider: `r2`.
- Tool uploads a local file and returns a Cloudflare R2 presigned GET URL.
- URLs are secret-link protected and time-limited, not one-time.
- Default expiry is 7 days: `604800` seconds.
- Object keys are deterministic: `runs/<runId>/<safe-filename>`.
- Allowed source files: relative paths under the run cwd or active agent folder.
- Reject absolute paths, backslashes, null bytes, `..`, and symlink escapes.
- Agent config:
```yaml
allowedIntents: [artifact.upload]
artifacts:
  upload:
    enabled: true
    connector: r2
    expiresInSeconds: 604800
    maxFileBytes: 25000000
```
- Required env:
```env
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET=
```
- Optional env: `JUMPYGOATHQ_ARTIFACT_EXPIRES_SECONDS`, `JUMPYGOATHQ_ARTIFACT_MAX_FILE_BYTES`, `JUMPYGOATHQ_ARTIFACT_UPLOAD_TIMEOUT_MS`.
- Tool params: `{ "path": "output/report.pdf", "filename": "report.pdf", "contentType": "application/pdf" }`.
- Return compact audit data only: key, filename, bytes, content type, expiry, status/error.
- Do not put R2 secrets in agent or automation markdown.
- Use the returned URL in email/webhook/Slack/Notion instead of attaching/syncing files.
