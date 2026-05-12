# skills

Pi skills live here in a personalized checkout. Active skill directories are personal/local instance state and are gitignored by default; only this README is part of the public template.

Each skill is a directory with a `SKILL.md` file:

```txt
skills/<name>/SKILL.md
```

Automations reference skills by name:

```yaml
skill: your-skill
```

## Connector intents

Skills gate external connector tools with `allowedIntents` in frontmatter. Automation config must also enable the same intent; both gates are required.

```yaml
---
name: research-brief
description: Build a brief using current web data.
allowedIntents:
  - web.search
  - web.scrape
  - notify.email
---
```

Provider-neutral intents and Pi tool names:

- `web.search` -> `web_search`
- `web.scrape` -> `web_scrape`
- `web.crawl` -> `web_crawl`
- `notify.email` -> `notify_email`

Skill instructions should tell Pi when to use a tool and when not to. Prefer the in-run `notify_email` tool over legacy fenced `agenthq-action` blocks; legacy blocks remain only for migration compatibility.

The web UI can create and edit skills as raw `SKILL.md` files. Treat this as advanced/system-prompt-like editing. Skill names are restricted to lowercase letters, numbers, and hyphens, and deletion is blocked while any automation references the skill.
