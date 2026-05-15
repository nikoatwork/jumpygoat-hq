# Frontend UX Audit Improvements

## Goal

Improve the raw HTML web UI so jumpyGoatHq feels trustworthy as a local agent-operations console. Prioritize accessibility, mobile usability, product clarity, and a calmer visual system without adding frontend frameworks or client-heavy dependencies.

## Notes

- Register: product. This is an operator console where design should serve task completion.
- Scene: a technical operator checks agent work, schedules, and task status in short focused sessions on a laptop, sometimes on a phone while away from the desk. The current dark operator theme fits local technical use, but it is visually heavier than the product needs.
- Validation already passes: `pnpm check:design` and `pnpm validate:web` both passed on 2026-05-15.
- `PRODUCT.md` and `DESIGN.md` now capture the product register and quiet operator visual system for future frontend work.
- Keep constraints from `packages/web/DOCS.md`: no React, Tailwind, CSS-in-JS, component libraries, client-side routing, or styling build step.

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | 2/4 | Several interactive links and summaries are below 44px touch target height; destructive confirmation inputs inside disclosure forms lack explicit labels. |
| 2 | Performance | 3/4 | Server-rendered UI is lean, but global backdrop blur, glow shadows, fixed background grid, and hover glows are heavier than needed. |
| 3 | Responsive Design | 2/4 | Mobile works without page-level horizontal scroll, but table and kanban experiences depend on horizontal scrolling and small controls. |
| 4 | Theming | 2/4 | Tokens exist, but colors are hex/RGBA, many hard-coded colors remain, and there is no documented theme contract. |
| 5 | Anti-Patterns | 2/4 | The UI has a generic cyber dashboard lane: dark gradients, cyan/purple glow, decorative grid, glassy panels, repeated cards. |
| **Total** | **11/20** | **Acceptable, significant UX work needed** |

## Anti-Patterns Verdict

Fail for distinctiveness. It does not look careless, but it does read like a familiar AI-generated dark operator dashboard because of the global noir theme, cyan/purple accent pair, blurred glass panels, glow-heavy hovers, decorative background grid, and metric/card grids. The product would feel more credible if it became quieter, denser, and more native to file-backed operations.

## Relevant Files

- `packages/web/public/styles.css` - Global tokens, layout, responsive behavior, tables, cards, kanban, and motion.
- `packages/web/src/html.ts` - Layout shell, navigation, common helpers, table rendering, badges, notices, empty states.
- `packages/web/src/routes.ts` - Page structure, copy, forms, destructive details, dashboard, kanban, agents, settings.
- `packages/web/public/kanban.js` - Drag/drop enhancement for status changes.
- `packages/web/DOCS.md` - UI constraints and intended server-rendered design system.
- `scripts/check-design-system.mjs` - Existing lightweight guardrail to extend as fixes land.
- `tests/web/*.spec.ts` - Existing Playwright coverage to extend with UX/a11y assertions.

## Tasks

- [x] 1.0 Establish design context and success criteria
  - [x] 1.1 Create `PRODUCT.md` with register `product`, users, product purpose, anti-references, design principles, and accessibility target.
  - [x] 1.2 Create `DESIGN.md` from the current raw HTML/CSS system, then update it with the intended calmer product direction.
  - [x] 1.3 Add a short UX acceptance checklist to `packages/web/DOCS.md`: touch targets, table behavior, form labels, empty states, reduced motion, and token usage.

- [x] 2.0 Fix accessibility blockers and friction
  - [x] 2.1 Raise interactive target heights to at least 44px for navigation, inline links styled as actions, summaries, kanban new-task links, cancel links, and table action links.
  - [x] 2.2 Add visible labels or `aria-label` text for confirmation inputs in delete forms.
  - [x] 2.3 Improve destructive flows: make delete disclosures clearly named, keep confirmation inputs associated with instructions, and ensure focus order is predictable when opened.
  - [x] 2.4 Convert status-only colored text into badge or text plus icon patterns so meaning is not color-only.
  - [x] 2.5 Add Playwright checks for unlabeled form controls and small interactive targets on core pages.

- [x] 3.0 Improve mobile and narrow viewport task flows
  - [x] 3.1 Replace the mobile sidebar wrap with a compact navigation pattern that consumes less vertical space while staying no-JS or progressively enhanced.
  - [x] 3.2 Make the kanban route usable on phones: focused single-column default under 640px, clear column switcher, no reliance on drag/drop.
  - [x] 3.3 Give table-heavy routes mobile alternatives for key data, especially automations, boards, runs, settings usage, schedule summaries, and task lists.
  - [x] 3.4 Keep horizontal overflow only for genuinely dense raw data tables, and add visible scroll affordances where overflow remains.
  - [x] 3.5 Add mobile viewport Playwright assertions for `/`, `/tasks`, `/automations`, `/agents/new`, `/settings`, and `/runs`.

- [x] 4.0 Quiet and professionalize the visual system
  - [x] 4.1 Convert color tokens in `styles.css` to OKLCH and remove remaining hard-coded hex values from component rules.
  - [x] 4.2 Reduce decorative glassmorphism: remove global backdrop blur from ordinary panels and reserve depth for focused overlays or elevated regions only.
  - [x] 4.3 Replace the cyber grid and glow-heavy hover treatment with a quieter local-operator surface, using accent color only for primary actions, active nav, links, and states.
  - [x] 4.4 Tune typography for product UI: fixed rem heading scale, less aggressive letter spacing, stronger body readability, and consistent label treatment.
  - [x] 4.5 Replace generic dashboard card grids where they do not teach a task. Dashboard cards should answer what to do next, not just show counts.

- [x] 5.0 Strengthen product clarity and page-specific UX
  - [x] 5.1 Rewrite overview copy to emphasize the main jobs: create helpers, queue work, schedule prompts, inspect receipts.
  - [x] 5.2 Improve empty states with concrete next actions and links instead of static absence messages.
  - [x] 5.3 Make schedule status easier to scan: separate authoring schedule, cron evidence, warnings, and next run.
  - [x] 5.4 Make settings safer by surfacing validation affordances, examples, and a clearer boundary that secrets do not belong there.
  - [x] 5.5 Improve raw markdown editing pages with brief guidance, examples, and safer cancel/back affordances.

- [x] 6.0 Reduce performance cost and respect user preferences
  - [x] 6.1 Remove or reduce global `backdrop-filter`, large glow shadows, and fixed decorative backgrounds.
  - [x] 6.2 Add `prefers-reduced-motion` rules that disable transitions and drag feedback motion where appropriate.
  - [x] 6.3 Audit hover/focus effects to avoid expensive visual effects on large repeated elements.
  - [x] 6.4 Keep `kanban.js` progressive: no drag/drop-only path, no alerts as the only error UX, and no reload when an inline update can be reflected safely.

- [x] 7.0 Add guardrails and close the loop
  - [x] 7.1 Extend `scripts/check-design-system.mjs` to flag hard-coded hex colors, decorative blur on common panels, and undersized action classes.
  - [x] 7.2 Add Playwright coverage for mobile nav, kanban focused mode, delete confirmation labeling, and table overflow behavior.
  - [x] 7.3 Run `pnpm validate:web` after frontend changes and inspect Playwright output.
  - [x] 7.4 Re-run a frontend UX audit and update this task list or archive it when complete.
  - [x] 7.5 Update `tasks/CHANGELOG.md` when the improvement pass ships.

## Suggested Impeccable Commands

1. `impeccable teach` to create `PRODUCT.md` and seed project context.
2. `impeccable document` to capture the visual system in `DESIGN.md`.
3. `impeccable quieter packages/web` to reduce cyber/glass treatment.
4. `impeccable adapt packages/web` to improve mobile navigation, tables, and kanban.
5. `impeccable harden packages/web` to handle labels, destructive flows, reduced motion, and edge cases.
6. `impeccable polish packages/web` as the final pass.

## Validation

- `pnpm check:design` passed.
- `pnpm validate:web` passed with 25 Playwright tests.

## Changelog

- Updated `tasks/CHANGELOG.md` and archived this task list in `tasks/done/`.
