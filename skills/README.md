# skills

Pi skills live here.

Each skill is a directory with a `SKILL.md` file:

```txt
skills/<name>/SKILL.md
```

Automations reference skills by name:

```yaml
skill: daily-review
```

The web UI can create and edit skills as raw `SKILL.md` files. Treat this as advanced/system-prompt-like editing. Skill names are restricted to lowercase letters, numbers, and hyphens, and deletion is blocked while any automation references the skill.
