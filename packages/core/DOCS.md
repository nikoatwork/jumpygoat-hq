# packages/core

Shared domain/service layer for jumpyGoatHQ.

`@jumpygoat-hq/core` owns product rules for file-backed CRUD and runtime status so the HTML UI, JSON API, and CLI do not duplicate validation or serialization logic.

## Owns

- Safe-name assertions for agents, automations, boards, and tasks
- DTOs with parsed fields, raw markdown when requested, warnings, file path, `updatedAt`, and weak `etag`
- Structured `CoreError` values with `code`, `message`, optional `fields`, and HTTP-ish `status`
- Agent CRUD and delete-reference guards
- Automation CRUD, canonical markdown serialization, and run-now dispatch
- Board/task CRUD and task status transitions
- Settings read/update validation
- Run listing/detail readers from SQLite
- Cron status parsing and install/uninstall wrappers

## Does not own

- HTML rendering
- JSON routing/auth
- CLI argument parsing/config
- Pi execution internals beyond invoking existing runner scripts for run-now

## Validation

```bash
pnpm --filter @jumpygoat-hq/core test:core
pnpm --filter @jumpygoat-hq/core build
```
