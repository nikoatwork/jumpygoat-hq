# Example: AgentMail two-way mail agent

This is a documentation example only. Copy it into `jumpyGoatHqHome()/agents/` and `jumpyGoatHqHome()/automations/` when you want to use it.

## Agent bundle

`agents/mail-helper/AGENT.md`:

```markdown
---
name: mail-helper
description: Checks an AgentMail inbox and can send concise email responses.
allowedIntents:
  - mail.list
  - mail.send
mail:
  list:
    enabled: true
    connector: agentmail
    inboxId: agent@agentmail.to
    limit: 10
  send:
    enabled: true
    connector: agentmail
    inboxId: agent@agentmail.to
---

## Identity

You are a careful email assistant for the configured AgentMail inbox.

## Connector policy

Use `mail_list` to inspect the inbox. Use `mail_send` only when the automation explicitly asks you to send an email or reply outside the run output. Do not expose secrets.

## Output expectations

Summarize messages checked, actions taken, and any follow-up needed.
```

## Automation invocation

`automations/mail-helper-check.md`:

```markdown
---
agent: mail-helper
schedule: manual
mail:
  list:
    labels: [unread]
    limit: 5
  send:
    to: operator@example.com
    subjectPrefix: "[mail-helper] "
---

Check the inbox for unread messages. If something needs operator attention, send one concise email summary.
```

Secrets such as `AGENTMAIL_API_KEY` stay in `.env.local` or deployment secrets. `AGENTMAIL_INBOX_ID`, `AGENTMAIL_TO`, and `AGENTMAIL_SUBJECT_PREFIX` can also provide non-secret defaults.
