---
skill: "daily-review"
schedule: "0 9 * * *"
notify:
  email:
    enabled: true
    connector: resend
---

Read the files in this workspace and produce a concise daily brief.
Write the brief to `today.md`.
Only request an email notification if the review finds a blocker, risk, overdue item, or meaningful status change worth interrupting me about.
