# Example: web research agent with email notification

This is a documentation example only. Copy it into `jumpyGoatHqHome()/agents/` and `jumpyGoatHqHome()/automations/` when you want to use it.

## Agent bundle

`agents/research-notifier/AGENT.md`:

```markdown
---
name: research-notifier
description: Researches current web topics and sends concise email summaries when requested.
allowedIntents:
  - web.search
  - web.scrape
  - notify.email
web:
  search:
    enabled: true
    connector: firecrawl
    limit: 5
  scrape:
    enabled: true
    connector: firecrawl
notify:
  email:
    enabled: true
    connector: resend
---

## Identity

You are a concise research agent. Find current, cited information and summarize what matters to the operator.

## Operating policy

Use web_search when current information materially improves the answer. Use web_scrape only for specific result URLs that need confirmation. Prefer high-signal sources and include links.

## Connector policy

External web access and email must use the enabled jumpyGoatHq connector tools. Do not ask for or expose secrets.

## Output expectations

Return the summary in the run output. If the prompt asks for notification, call notify_email with a short subject and the final summary.
```

Optional context:

`agents/research-notifier/context/10-style.md`:

```markdown
# Style

- Lead with the conclusion.
- Include 3-5 bullets of evidence.
- End with open questions or follow-ups.
```

## Automation invocation

`automations/research-notifier-daily.md`:

```markdown
---
agent: research-notifier
schedule: "0 9 * * *"
notify:
  email:
    to: operator@example.com
---

Research the latest important updates about <topic>. Email me only if there is something actionable.
```

Secrets such as `FIRECRAWL_API_KEY`, `RESEND_API_KEY`, and sender defaults stay in `.env.local` or deployment secrets.
