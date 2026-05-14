# Lightweight Web Design System

## Completion Summary

Completed on 2026-05-14: added lightweight raw-HTML UI conventions, CSS component classes, server-side helper primitives, stable page refactors, docs, and passing web validation.

## Goal

Standardize the raw HTML web UI styling, spacing, and common markup patterns without adding frontend dependencies, frameworks, build steps, or component libraries. The result should make future pages more consistent by using a small CSS vocabulary plus tiny server-side HTML helper primitives.

## Notes

- Keep the web UI server-rendered raw HTML. Do not add React, Tailwind, CSS-in-JS, a bundler, or client-side routing for this work.
- Prefer small, named primitives over one-off route-level markup. This is a lightweight design system, not a frontend platform rewrite.
- Preserve the current retro/cyberpunk visual theme; standardize structure and spacing rather than redesigning the product.
- Refactor incrementally so diffs stay reviewable and validation remains simple.
- Avoid touching unrelated in-progress project/task queue work unless needed for shared CSS/helper compatibility.

## Relevant Files

- `packages/web/src/html.ts` - Shared layout, escaping, icon, and new HTML helper primitives.
- `packages/web/src/routes.ts` - Current server-rendered route strings; incrementally adopt helpers for common patterns.
- `packages/web/public/styles.css` - Central design tokens, component classes, utilities, and responsive rules.
- `packages/web/DOCS.md` - Add UI conventions/design-system notes for future contributors.
- `tests/web/smoke.spec.ts` - Keep smoke coverage passing after markup/class standardization.
- `tests/web/schedule.spec.ts` - Schedule page coverage may need minor selector updates if markup changes.
- `tasks/CHANGELOG.md` - Dated task summary for close-out tracking.

## Tasks

- [x] 1.0 Define the lightweight UI conventions
  - [x] 1.1 Document the no-new-dependencies constraint for this work.
  - [x] 1.2 Define canonical spacing/layout primitives: page header, section/panel, toolbar, inline actions, empty state, notices, forms, tables, badges.
  - [x] 1.3 Decide naming conventions for CSS classes: semantic component classes over broad utility sprawl.
  - [x] 1.4 Identify page-specific CSS that should remain page-specific, such as kanban and agenda layouts.

- [x] 2.0 Organize and standardize CSS
  - [x] 2.1 Reorganize `styles.css` into clear sections: tokens, base, layout primitives, components, utilities, page-specific rules, responsive rules.
  - [x] 2.2 Normalize spacing defaults for headings, sections, panels, forms, tables, and action rows using existing `--space-*` tokens.
  - [x] 2.3 Add/standardize component classes: `.page-header`, `.page-actions`, `.section`, `.toolbar`, `.inline-actions`, `.empty-state`, `.notice`, `.badge`, `.form-stack`, `.form-grid`, `.table-wrap`, `.meta-table`.
  - [x] 2.4 Preserve existing theme variables and current visual identity.
  - [x] 2.5 Remove or merge duplicate/overlapping class rules where safe.

- [x] 3.0 Add tiny server-side HTML helper primitives
  - [x] 3.1 Add helpers in `html.ts` for page headers, sections/panels, toolbars/actions, notices, badges, empty states, and basic tables.
  - [x] 3.2 Keep helpers string-based, dependency-free, escaped by default where practical, and easy to bypass for custom markup.
  - [x] 3.3 Ensure helpers do not hide important semantics or make route code hard to scan.
  - [x] 3.4 Add short inline comments only where helper usage could be ambiguous.

- [x] 4.0 Refactor stable pages to the conventions
  - [x] 4.1 Refactor dashboard markup to use page header/section/table or empty-state conventions.
  - [x] 4.2 Refactor automations list/detail/form pages for standardized actions, forms, tables, and errors.
  - [x] 4.3 Refactor agents list/detail/form pages for the same conventions.
  - [x] 4.4 Refactor schedule page to use standardized page header, notices, badges, sections, and table wrappers while preserving agenda-specific layout.
  - [x] 4.5 Leave unstable or broader task/project queue UI mostly untouched unless a small shared helper adoption is low-risk. - Kept kanban/project route structure intact; only shared table wrappers touched low-risk output.

- [x] 5.0 Document the mini design system
  - [x] 5.1 Update `packages/web/DOCS.md` with a UI conventions section.
  - [x] 5.2 Include examples for common route patterns: page header with actions, empty table state, notice, form stack, and badge.
  - [x] 5.3 Explicitly state when not to add dependencies and when a future React/client-heavy migration could be reconsidered.

- [x] 6.0 Validate and close out
  - [x] 6.1 Run `pnpm validate:web` and inspect Playwright output.
  - [~] 6.2 Fix selector regressions in smoke tests only if markup semantics intentionally changed. - Skipped: existing selectors pass after renaming the runs subsection to avoid a fuzzy heading collision.
  - [x] 6.3 Add a dated one-line summary to `tasks/CHANGELOG.md`.
  - [x] 6.4 Archive this task to `tasks/done/YYYY-MM-DD_tasks-web-design-system.md` when complete.
  - [x] 6.5 Commit only the intentionally touched files for this task. - User requested committing all unstaged changes.

## Decisions

- No new frontend dependencies, frameworks, bundlers, or styling libraries.
- Keep server-rendered HTML strings and a single CSS file.
- Use a small helper layer in `html.ts` plus documented CSS classes as the design system.
