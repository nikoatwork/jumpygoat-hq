# automations

Each automation is one markdown file with YAML frontmatter and a prompt body.

```markdown
---
skill: daily-review
schedule: "manual"
model: anthropic/claude-sonnet-4-5
---

Review the workspace and write a brief.
```

Run with:

```bash
pnpm build
pnpm runner <name>
```

The web UI can create and edit these files. It writes canonical frontmatter, requires an existing skill, accepts `manual` or 5-field cron schedules, and restricts filenames to lowercase letters, numbers, and hyphens.
