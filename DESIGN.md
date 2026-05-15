# Design

## Design System Name

jumpyGoat quiet operator

## Summary

The web UI is a raw HTML product console for local agent operations. It uses a restrained dark theme, native-feeling controls, semantic server-rendered components, and dense but readable layouts. The design should feel closer to a local operations bench than a neon AI dashboard.

## Color

Use OKLCH tokens in `packages/web/public/styles.css`. The palette is restrained: tinted dark neutrals carry the surface, while a single cyan-green accent marks primary actions, active navigation, links, focus, and selected state. Success, warning, danger, and info colors are semantic only.

Primary tokens:

- Background: `--bg`, `--bg-2`
- Surfaces: `--surface`, `--surface-2`, `--surface-3`
- Text: `--text`, `--text-strong`, `--muted`, `--muted-2`
- Lines: `--line`, `--line-strong`
- Accent: `--accent`
- States: `--success`, `--warning`, `--danger`, `--info`

Avoid decorative glows, glass panels, gradient text, and large saturated accents on inactive elements.

## Typography

Use the existing system UI stack with Inter first when available:

`Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

Use `ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace` for file ids, model selectors, paths, cron values, and trace metadata. Product headings use fixed rem sizing, compact weight contrast, and moderate negative tracking only on page titles.

## Layout

The app uses a persistent left sidebar on desktop and a compact top navigation stack on narrow screens. Content is server-rendered into `main` with shared sections, tables, forms, notices, and badges. Dense data may remain in tables on desktop; narrow screens should use responsive table cards or focused views.

Spacing should be practical, not decorative. Avoid nested cards unless the inner element is an actual record in a list, such as a task card inside a kanban column.

## Components

Canonical helpers live in `packages/web/src/html.ts`:

- `pageHeader`
- `section`
- `toolbar`
- `inlineActions`
- `notice`
- `badge`
- `emptyState`
- `table`
- `metaTable`

Controls must have visible focus, 44px target height where they behave as actions, and explicit labels for form inputs. Status should use text plus a visible marker through `.status-badge`, not color-only spans.

## Motion

Motion is minimal and state-driven. Use short 140ms transitions with an ease-out cubic curve for hover and active feedback only. Respect `prefers-reduced-motion` and avoid animation that delays task completion.

## Responsive Behavior

At tablet widths, the sidebar becomes a compact top region. At phone widths, grids collapse to one column, kanban columns stack vertically, focused kanban links remain available, and helper tables render row cards with data labels. No core workflow should require drag/drop.

## Accessibility

Design to WCAG AA. Preserve semantic headings, landmarks, labeled forms, visible focus rings, sufficient contrast, non-color-only state indicators, and readable table alternatives on small screens.
