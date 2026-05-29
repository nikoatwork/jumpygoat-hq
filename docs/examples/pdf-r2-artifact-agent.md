# PDF report artifact agent example

This example shows the intended artifact flow: create or receive a PDF, upload it with `artifact_upload`, then send the returned expiring URL through a mail connector.

## Agent frontmatter

```yaml
---
name: pdf-report-agent
description: Creates PDF reports and shares them as expiring artifact links.
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

## Automation

```yaml
---
agent: pdf-report-agent
schedule: manual
mail:
  send:
    to: client@example.com
---

Prepare `output/report.pdf`. Upload it with `artifact_upload`, then send one concise email containing the returned download URL and expiry time.
```

## Expected tool sequence

1. Agent creates or finds `output/report.pdf` in the run workspace.
2. Agent calls:

```json
{
  "path": "output/report.pdf",
  "filename": "report.pdf",
  "contentType": "application/pdf"
}
```

3. `artifact_upload` stores `runs/<runId>/report.pdf` in private R2 and returns a presigned URL.
4. Agent calls `mail_send` with the URL and expiry.

Run records keep compact connector summaries: key, filename, bytes, content type, expiry, status/error. They do not store the PDF contents.
