# Firecrawl connector

Firecrawl gives automations bounded web search, scrape, and crawl tools.

## Tools

| Intent | Tool | What it does |
| --- | --- | --- |
| `web.search` | `web_search` | Search the web and return concise results. |
| `web.scrape` | `web_scrape` | Scrape one HTTP(S) page and return bounded content. |
| `web.crawl` | `web_crawl` | Crawl a small bounded set of pages with page/depth limits. |

## 1. Add the secret

Create or update `.env.local`:

```env
FIRECRAWL_API_KEY=fc_...
```

Make sure the same env var is available to cron/deployment if scheduled automations will use Firecrawl.

## 2. Enable intents on the agent

`agents/researcher/AGENT.md`:

```yaml
---
name: researcher
allowedIntents:
  - web.search
  - web.scrape
  - web.crawl
web:
  search:
    enabled: true
    connector: firecrawl
    limit: 5
  scrape:
    enabled: true
    connector: firecrawl
    maxOutputChars: 12000
  crawl:
    enabled: false
    connector: firecrawl
    maxPages: 5
    maxDepth: 1
---
```

Only include intents the agent should be allowed to use. For example, a lightweight news agent may only need `web.search` and `web.scrape`.

## 3. Optionally override per automation

`automations/daily-research.md`:

```yaml
---
agent: researcher
schedule: "0 9 * * *"
web:
  search:
    limit: 3
  scrape:
    maxOutputChars: 8000
---

Search for important updates and summarize them with source links.
```

## Config fields

Common fields:

- `enabled`: `true` exposes the tool when the agent also allows the intent.
- `connector`: must be `firecrawl`.
- `timeoutMs`: optional provider timeout.
- `maxOutputChars`: bounds returned tool content.

Search:

- `limit`: default search result limit, max 10.

Crawl:

- `maxPages`: max pages, max 10.
- `maxDepth`: max crawl depth, max 3.

## Validate

```bash
pnpm run doctor
pnpm --filter @jumpygoat-hq/runner test:connectors
```

Doctor will report Firecrawl as optional if `FIRECRAWL_API_KEY` is not set. Missing keys become tool errors only when an enabled automation actually calls the tool.
