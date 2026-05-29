# Resend connector

Resend sends one-way notification emails from automations. Use it when an agent should notify an operator, not when it needs a persistent two-way inbox. For two-way inbox workflows, use the [AgentMail connector](agentmail.md).

## Tools

| Intent | Tool | What it does |
| --- | --- | --- |
| `notify.email` | `notify_email` | Sends one plain-text notification email through Resend. |

## 1. Verify a sender in Resend

In Resend, verify the domain/address you will use as `from`. The connector cannot send from an unverified sender.

## 2. Add secrets/defaults

Create or update `.env.local`:

```env
RESEND_API_KEY=re_...
JUMPYGOATHQ_NOTIFY_EMAIL_FROM="jumpyGoatHq <agent@example.com>"
JUMPYGOATHQ_NOTIFY_EMAIL_TO=operator@example.com
JUMPYGOATHQ_NOTIFY_SUBJECT_PREFIX="[jumpyGoatHq] "
```

Only `RESEND_API_KEY` is secret. The `to`, `from`, and subject prefix can also be supplied in agent/automation frontmatter instead of env.

## 3. Enable the intent on the agent

`agents/notifier/AGENT.md`:

```yaml
---
name: notifier
allowedIntents:
  - notify.email
notify:
  email:
    enabled: true
    connector: resend
---
```

In the markdown instructions, tell the agent when email is warranted. `notify_email` sends immediately when Pi calls it, so the agent policy is the confirmation layer.

## 4. Optionally override per automation

`automations/daily-summary.md`:

```yaml
---
agent: notifier
schedule: "0 17 * * *"
notify:
  email:
    to: operator@example.com
    from: "jumpyGoatHq <agent@example.com>"
    subjectPrefix: "[daily] "
---

Run the daily check. Email me only if there is something actionable.
```

## Config fields

- `enabled`: `true` exposes `notify_email` when the agent also allows `notify.email`.
- `connector`: `resend`; optional today because Resend is the default for `notify.email`.
- `to`: default recipient.
- `from`: verified Resend sender.
- `subjectPrefix`: prefix applied to tool-provided subjects.

## Validate

```bash
pnpm run doctor
pnpm --filter @jumpygoat-hq/runner test:connectors
```

Doctor warnings for missing Resend defaults do not fail because an automation may provide those values at run time. Missing API key/recipient/sender become tool errors only when an enabled automation actually calls `notify_email`.
