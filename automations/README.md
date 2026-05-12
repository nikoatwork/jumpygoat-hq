# automations

Each automation is one markdown file with YAML frontmatter and a prompt body. Active automation files are personal/local instance state and are gitignored by default; only this README is part of the public template.

```markdown
---
skill: your-skill
schedule: "manual"
model: anthropic/claude-sonnet-4-5
---

Prompt body sent to Pi.
```

Run with:

```bash
pnpm build
pnpm runner <name>
```

## Connector config

Connector tools are enabled in automation frontmatter, but are exposed to Pi only when the referenced skill also lists the matching provider-neutral intent in `allowedIntents`.

```yaml
web:
  search:
    enabled: true
    connector: firecrawl
    limit: 5
  scrape:
    enabled: true
    connector: firecrawl
  crawl:
    enabled: true
    connector: firecrawl
    maxPages: 5
    maxDepth: 1
notify:
  email:
    enabled: true
    connector: resend
    to: user@example.com
    from: "AgentHQ <agent@example.com>"
```

Available intents/tools:

- `web.search` -> `web_search` (Firecrawl)
- `web.scrape` -> `web_scrape` (Firecrawl)
- `web.crawl` -> `web_crawl` (Firecrawl)
- `notify.email` -> `notify_email` (Resend)

Secrets live in `.env.local`/environment, not automation files: `FIRECRAWL_API_KEY`, `RESEND_API_KEY`, and optional email defaults.

The web UI can create and edit these files. It writes canonical frontmatter, requires an existing skill, accepts `manual` or 5-field cron schedules, and restricts filenames to lowercase letters, numbers, and hyphens.
