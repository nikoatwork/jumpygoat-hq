# AgentMail connector

AgentMail gives automations a persistent email inbox. Use it when agents need to send mail from their own address and check received messages.

Docs: <https://docs.agentmail.to/quickstart>

## Tools

| Intent | Tool | What it does |
| --- | --- | --- |
| `mail.send` | `mail_send` | Sends an email from an AgentMail inbox. |
| `mail.list` | `mail_list` | Lists recent messages in an AgentMail inbox with bounded previews. |

## 1. Create/get an AgentMail API key and inbox

You can use the AgentMail Console or the AgentMail agent sign-up flow. You need:

- `AGENTMAIL_API_KEY`: secret API key, starts with `am_...`.
- `AGENTMAIL_INBOX_ID`: default inbox id/address, for example `cronos@agentmail.to`.

## 2. Add local secrets/defaults

Create or update `.env.local`:

```env
AGENTMAIL_API_KEY=am_...
AGENTMAIL_INBOX_ID=cronos@agentmail.to
# Optional outbound defaults:
AGENTMAIL_TO=operator@example.com
AGENTMAIL_SUBJECT_PREFIX="[agent] "
```

Only `AGENTMAIL_API_KEY` is secret. Inbox and recipient defaults can also be set in agent/automation frontmatter.

Make sure the same env vars are available to cron/deployment if scheduled automations will use AgentMail.

## 3. Enable intents on the agent

`agents/mail-helper/AGENT.md`:

```yaml
---
name: mail-helper
description: Checks an AgentMail inbox and can send concise messages.
allowedIntents:
  - mail.list
  - mail.send
mail:
  list:
    enabled: true
    connector: agentmail
    inboxId: cronos@agentmail.to
    limit: 10
  send:
    enabled: true
    connector: agentmail
    inboxId: cronos@agentmail.to
---
```

If the `inboxId` is omitted here, the connector uses `AGENTMAIL_INBOX_ID`.

In the agent markdown instructions, be explicit about when sending is allowed. `mail_send` sends immediately when Pi calls it.

## 4. Optionally override per automation

`automations/check-mail.md`:

```yaml
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

Check unread inbox messages. If anything needs operator attention, send one concise summary email.
```

## Config fields

Common fields:

- `enabled`: `true` exposes the tool when the agent also allows the intent.
- `connector`: must be `agentmail`.
- `inboxId`: AgentMail inbox id/address. Defaults to `AGENTMAIL_INBOX_ID`.
- `timeoutMs`: optional provider timeout.

Send fields:

- `to`: default recipient. Defaults to `AGENTMAIL_TO`. The tool call can override it.
- `subjectPrefix`: prefix applied to tool-provided subjects. Defaults to `AGENTMAIL_SUBJECT_PREFIX`.
- `labels`: optional labels to attach to sent messages.

List fields:

- `limit`: default message count, max 50.
- `labels`: optional labels filter, for example `[unread]`.
- `maxOutputChars`: bounds returned inbox content.

## Validate

```bash
pnpm run doctor
pnpm --filter @jumpygoat-hq/runner test:connectors
```

Doctor will not fail if AgentMail is absent. It warns only when AgentMail appears partially configured, such as an API key without a default inbox id. Missing config becomes a tool error only when an enabled automation actually calls `mail_send` or `mail_list`.

## Live inbox check

After setting `AGENTMAIL_API_KEY` and `AGENTMAIL_INBOX_ID`, create a manual automation using `mail.list` and run it, or use the AgentMail API/CLI directly to list messages. The connector returns compact message metadata and previews; it does not dump full raw email content into run records.
