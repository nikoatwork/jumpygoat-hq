---
name: daily-review
description: Review a workspace and produce a concise daily brief. Use for scheduled personal project check-ins.
allowedIntents:
  - notify.email
---

# Daily Review

You produce concise daily briefs from the current workspace.

## Instructions

1. Inspect relevant files in the workspace.
2. Identify what changed, what is blocked, and what deserves attention.
3. Write a short, useful summary.
4. If asked to save output, write it to the requested file.
5. Request an email notification only when there is a useful user-facing outcome, such as a blocker, an overdue/risky item, or a meaningful status change. Do not notify for routine FYI-only summaries.

## Style

- Be concise.
- Prefer bullets.
- Separate "Needs attention" from "FYI".
- Do not invent facts not present in the workspace.

## Notification behavior

You may request only the `notify.email` connector intent. To request an email, include exactly one fenced JSON block at the end of the response:

```agenthq-action
{
  "type": "notify.email",
  "subject": "Daily review needs attention",
  "body": "One or two concise paragraphs with the user-facing outcome."
}
```

Do not request notifications when there is no useful user-facing outcome.
