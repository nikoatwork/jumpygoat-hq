---
name: agenthq-validate
description: Run and interpret local agenthq validation after code changes. Use when checking whether frontend or backend work in this repository actually works.
---

# agenthq validation

Use this skill inside the `agenthq` repo when you need a lean self-validating loop.

## Commands

- Frontend/web changes: `pnpm validate:web`
- Runner/backend/Pi changes: `pnpm validate:backend`
- Broad confidence check: `pnpm validate`

## Interpretation

1. Treat non-zero exit as a hard failure.
2. Read stdout/stderr before declaring success.
3. For Playwright failures, inspect the failing route/assertion first; screenshots/traces are retained only on failure.
4. For backend failures, inspect the smoke summary plus `output tail`, `error tail`, and `trace tail` sections.
5. `validate:backend` runs exactly one automation by default: `daily-review`. Override only when intentional:

```bash
AGENTHQ_SMOKE_AUTOMATION=daily-review pnpm validate:backend
```

## Constraints

- Local-only; no CI assumption.
- Do not run every automation as part of normal validation.
- Do not install/uninstall cron during validation.
- Backend validation may call Pi/OpenAI Codex and requires local Pi auth/provider setup.
