# Classic Web Redesign

## Completion summary

Completed 2026-06-17. The raw HTML web UI now has a documented classic Mac/System.css design language, local UIM-based icon helpers, reusable server-rendered primitives, refreshed sidebar/page IA, updated visual/IA smoke coverage, and passing design/web validation. Temporary screenshot artifacts were captured, inspected, and removed.

## Goal

Redesign the full raw-HTML web UI into a coherent classic Mac/System.css-inspired application: monochrome, high-contrast, spacious, icon-rich, and easy for a non-technical but AI-native operator to understand. Define reusable CSS/server-rendered primitives, then apply them page by page with Playwright screenshot review and updated tests.

## Notes

- Full redesign scope across primary pages, forms, detail pages, and shared layout.
- Remain raw server-rendered HTML + CSS. No React, Tailwind, bundler, CSS-in-JS, or frontend framework.
- Server-side HTML primitives in `src/html.ts` are encouraged: cards, panels, icon labels, page grids, form panels, empty states, etc.
- Use one icon set consistently. Prefer the newly vendored UIM icons if they cover UI needs; reserve Simple Icons only for brand/provider marks if needed.
- Screenshots are temporary validation artifacts: capture one per page/route family during work, inspect them, then delete if acceptable.
- It is acceptable to reorganize pages for the desired operator outcome and hide dense secondary/technical details behind collapsible panels.
- Update Playwright tests to assert durable IA/visual conventions where useful, not only functional smoke behavior.

## Relevant Files

- `DESIGN.md` - Durable design-system language, spacing, typography, component primitives, and visual goals.
- `packages/web/DOCS.md` - Web package conventions and validation expectations.
- `packages/web/public/styles.css` - Main CSS implementation for System.css adapter and app primitives.
- `packages/web/src/html.ts` - Shared server-rendered HTML helpers/primitives and icon helpers.
- `packages/web/src/routes.ts` - Page markup and route-specific composition.
- `packages/web/public/icons/README.md` - Vendored icon inventory and icon-source guidance.
- `packages/web/public/icons/uim/*.svg` - Candidate UI icon set.
- `packages/web/public/icons/simple/*.svg` - Brand/provider icons only if needed.
- `tests/web/smoke.spec.ts` - Functional + visual/IA smoke expectations.
- `tests/web/settings.spec.ts` - Settings page expectations.
- `tests/web/*.spec.ts` - Additional route/API coverage that must remain passing.
- `scripts/check-design-system.mjs` - Lightweight design-system guardrails.

## Tasks

- [x] 1.0 Define the CSS/server-rendered design-system primitives
  - [x] 1.1 Update `DESIGN.md` with target style: classic Mac/System.css, monochrome gray tones, restrained type scale, spacing scale, line/border rules, icon usage, and density rules.
  - [x] 1.2 Define default spacing tokens in `styles.css` for page, section, card, form, grid, and table rhythm.
  - [x] 1.3 Define a restrained heading scale so page H1/H2-level headlines are prominent but not oversized.
  - [x] 1.4 Decide the one primary UI icon set and document when brand icons are allowed.
  - [x] 1.5 Add/adjust server-side helpers in `src/html.ts` for reusable primitives: `appIcon`, `iconLabel`, `card`, `folderCard`, `panel`, `formPanel`, `pageGrid`, and action/link variants as useful.
  - [x] 1.6 Update `scripts/check-design-system.mjs` to guard the new core primitives and forbid reintroducing dense one-off styling patterns.

- [x] 2.0 Make icon usage consistent and local
  - [x] 2.1 Replace current `pepicons` usage with the selected local icon helper, or explicitly remove `pepicons` if no longer needed.
  - [x] 2.2 Map all existing icon needs (`overview`, `tasks`, `boards`, `automations`, `schedule`, `agents`, `runs`, `settings`, `create`, `edit`, `delete`, `run`, `save`) to the chosen icon set.
  - [x] 2.3 Use icons in navigation, page actions, empty states, statuses, cards, and key forms without making pages visually noisy.
  - [x] 2.4 Keep local SVG footprint small; delete unused vendored icons if the shortlist grows stale.

- [x] 3.0 Redesign the global shell and sidebar IA
  - [x] 3.1 Refine the top branding to `Jumpy Goat HQ` or `Jumpy Goat Headquarters` consistently across title/menu/sidebar.
  - [x] 3.2 Build a polished Finder-like collapsible sidebar tree with folders/subfolders, connecting lines, active state, and accessible `<details>/<summary>` behavior.
  - [x] 3.3 Ensure sidebar groups match product IA for a non-technical AI-native user: Overview, Work, Automations, Agents, Activity, Settings.
  - [x] 3.4 Tune desktop and mobile shell spacing so the app feels calm, not dense, and avoids horizontal overflow.
  - [x] 3.5 Capture and inspect screenshots for `/` at desktop and mobile widths; delete screenshots after approval.

- [x] 4.0 Redesign Overview for orientation and next actions
  - [x] 4.1 Reorganize Overview around operator intent: what needs attention, what can be run/created, what recently happened.
  - [x] 4.2 Convert concept/stat/activity areas to reusable card/panel primitives with icons and enough whitespace.
  - [x] 4.3 Move secondary local setup details behind a calm collapsible panel.
  - [x] 4.4 Update tests for Overview IA conventions and action target accessibility.
  - [x] 4.5 Capture/inspect/delete Overview screenshot.

- [x] 5.0 Redesign Tasks and Kanban
  - [x] 5.1 Make Tasks read as an AI work queue for non-technical users, with clear status meanings and next actions.
  - [x] 5.2 Restyle kanban columns as classic windows/folders while preserving non-JS status movement.
  - [x] 5.3 Add icons to status filters, cards, assignee/model metadata, and create actions where useful.
  - [x] 5.4 Improve focused `?status=` view and mobile stacked columns.
  - [x] 5.5 Capture/inspect/delete Tasks screenshot.

- [x] 6.0 Redesign Boards and task detail/edit flows
  - [x] 6.1 Restyle Boards list as folder/project cards or a calmer table depending on data density.
  - [x] 6.2 Make Board detail explain context and next task actions clearly.
  - [x] 6.3 Restyle task detail around prompt, assignee, status movement, and run evidence.
  - [x] 6.4 Convert board/task create/edit forms to the shared form primitive.
  - [x] 6.5 Capture/inspect/delete Boards and task detail/form screenshots.

- [x] 7.0 Redesign Automations and Schedule
  - [x] 7.1 Make Automations feel like reusable scheduled agents, not raw markdown rows.
  - [x] 7.2 Use cards/panels/icons for schedule, agent, model, connector, cron evidence, and manual run action.
  - [x] 7.3 Keep dense prompt/previews scannable and hide technical warnings/details when appropriate.
  - [x] 7.4 Redesign Schedule as a calm agenda/timeline with clear installed/not-installed evidence.
  - [x] 7.5 Convert automation create/edit forms to the shared form primitive.
  - [x] 7.6 Capture/inspect/delete Automations, Schedule, and automation form/detail screenshots.

- [x] 8.0 Redesign Agents
  - [x] 8.1 Make Agents read as a roster of AI helpers with role, workload, permissions, and next actions.
  - [x] 8.2 Use profile/folder/window card primitives consistently.
  - [x] 8.3 Improve delete/edit/profile actions and technical references without overwhelming the page.
  - [x] 8.4 Convert agent create/edit forms to the shared form primitive.
  - [x] 8.5 Capture/inspect/delete Agents and agent form/detail screenshots.

- [x] 9.0 Redesign Runs and run detail
  - [x] 9.1 Make Runs read as receipts/history for AI work, with status, source, agent, duration, model, and cost/usage cues.
  - [x] 9.2 Restyle run list as readable receipt cards or a calmer responsive table.
  - [x] 9.3 Reorganize run detail around outcome first, then model/usage, trace timeline, output/error, and raw trace details.
  - [x] 9.4 Keep raw trace JSON hidden behind clear advanced collapsibles.
  - [x] 9.5 Capture/inspect/delete Runs and run detail screenshots.

- [x] 10.0 Redesign Settings
  - [x] 10.1 Make Settings explain instance-local model configuration in non-technical language.
  - [x] 10.2 Separate model profiles, usage, settings file metadata, and YAML editor into clear panels.
  - [x] 10.3 Use icons for provider/model/usage/security cues where helpful.
  - [x] 10.4 Preserve no-secrets guidance and validation feedback.
  - [x] 10.5 Capture/inspect/delete Settings screenshot.

- [x] 11.0 Update visual/IA tests and validation workflow
  - [x] 11.1 Update Playwright smoke tests for reusable IA conventions: local icons render, primary actions exist, sidebar tree works, pages avoid dense overflow, mobile remains usable.
  - [x] 11.2 Add tests for collapsible sidebar groups where practical.
  - [x] 11.3 Ensure forms remain labeled and action targets remain at least 44px.
  - [x] 11.4 Run `pnpm check:design` and `pnpm validate:web` after each major page-family pass.
  - [x] 11.5 Run final `pnpm validate:web` and inspect screenshots/traces if failures occur.

- [x] 12.0 Documentation and cleanup
  - [x] 12.1 Update `packages/web/DOCS.md` with the finalized primitive/component conventions and screenshot review loop.
  - [x] 12.2 Remove temporary screenshots and any unused icon files/helpers.
  - [x] 12.3 Update `tasks/CHANGELOG.md` with a dated completion summary when done.
  - [x] 12.4 Archive this task to `tasks/done/YYYY-MM-DD_tasks-classic-web-redesign.md` when complete.

## Decisions

- Full redesign, not a small first milestone.
- Server-side HTML primitives are allowed and preferred for consistency.
- Use one primary icon set for UI; brand icons only where the UI needs brand/provider recognition.
- Capture one screenshot per page/page-family during implementation, inspect it, and delete it if acceptable.
- Reorganize/hide dense secondary technical details when it improves the non-technical AI-native operator experience.
- Update tests to cover durable visual/IA conventions in addition to functional behavior.
