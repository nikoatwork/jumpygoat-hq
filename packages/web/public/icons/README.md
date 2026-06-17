# Vendored icon shortlist

Small, local SVG shortlist for the raw HTML web UI. We intentionally vendor individual SVGs instead of adding large icon packages or remote CDN dependencies.

UIM is the primary UI icon set. Use `appIcon()` / `iconLabel()` from `packages/web/src/html.ts` for app navigation, actions, cards, forms, statuses, and empty states. Use Simple Icons only for provider/brand recognition.

- `uim/*.svg` — Unicons Monochrome via Iconify (`@iconify-json/uim`, Apache-2.0)
- `simple/*.svg` — Simple Icons via Iconify (`@iconify-json/simple-icons`, CC0-1.0)

All copied SVGs use `fill="currentColor"` and are suitable for the monochrome System.css style.

## 48 icons worth keeping around

### Product / navigation / layout (UIM)

- `apps` — overview/dashboard
- `grid` — dashboard/grid view
- `window-grid` — windows/panels
- `bars` — compact menu/sidebar affordance
- `list-ul` — task lists
- `table` — tabular data
- `layer-group` — boards/grouped work
- `document-layout-left` — files/details/docs
- `calendar` — schedules
- `schedule` — scheduled automations
- `clock` — run timing
- `history` — activity/runs history
- `process` — automation/process flow
- `rocket` — run/dispatch action

### Actions / state / safety (UIM)

- `plus-square` — create/add
- `check` — save/confirm
- `check-circle` — success/ok
- `check-square` — installed/enabled
- `times-circle` — delete/close/failure
- `multiply` — cancel/clear
- `exclamation-triangle` — warning
- `exclamation-octagon` — error/blocked
- `analytics` — usage/metrics
- `graph-bar` — run summaries
- `link-h` — links/API reference
- `lock` — auth/locked state
- `lock-open-alt` — unlocked/local dev
- `key-skeleton` — API token/secret reference
- `shield-plus` — policy/permission gates
- `refresh` — rerun/sync/reload
- `upload-alt` — import/upload
- `download-alt` — export/download
- `angle-right` — collapsed tree item
- `angle-down` — expanded tree item

### Integrations / technology brands (Simple Icons)

- `github` — repositories/source control
- `slack` — Slack notifications/integration
- `openai` — OpenAI model/provider references
- `anthropic` — Anthropic model/provider references
- `google` — Google/search/provider references
- `ollama` — local model/provider references
- `sqlite` — local run database
- `pnpm` — package runner/dev commands
- `npm` — package ecosystem
- `nodedotjs` — Node runtime
- `typescript` — TypeScript scripts
- `javascript` — JavaScript scripts
- `docker` — deployments/containers
- `resend` — email notification connector
