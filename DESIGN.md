# Design

## Design System Name

jumpyGoat classic operator

## Summary

The web UI is a raw HTML product console for local agent operations. It uses [`@sakun/system.css`](https://github.com/sakofchit/system.css) as the classic Mac/System 6 base, then layers a small server-rendered app design system on top: monochrome, high-contrast, roomy, icon-rich, and easy for a non-technical but AI-native operator to scan.

## Visual Language

Use System.css as the base style layer. `packages/web/public/styles.css` is only the app adapter: layout shell, responsive behavior, accessibility target sizes, spacing tokens, and route-specific glue.

Keep the tone monochrome and utilitarian. Use white, black, and a few grays (`--jg-muted`, `--jg-soft`) rather than saturated colors. Status must be communicated by labels, symbols, and text, not by color alone. Avoid decorative glows, glass panels, gradient text, shadows beyond classic hard-offset window/card shadows, and large saturated accents.

## Typography

System.css supplies the classic Chicago/Monaco-style fonts. Use Chicago-style headings for page and panel labels, and Monaco or a monospace fallback for file ids, model selectors, paths, cron values, and trace metadata.

Heading scale is restrained:

- Page headline (`h2`): prominent but not billboard-sized (`clamp(1.8rem, 3.1vw, 3rem)`).
- Section/panel headline (`h3`): strong window-label scale (`clamp(1.35rem, 1.9vw, 1.9rem)`).
- Record/card headline (`h4`): compact title scale around `1.15rem`.

## Layout and Spacing

The app uses a persistent left Finder-like sidebar window on desktop and a compact stacked layout on narrow screens. Content is server-rendered into a primary System.css `.standard-dialog` with shared sections, panels, folder cards, tables, forms, notices, and badges.

Spacing should feel calm, not decorative:

- Page padding: `--jg-space-page-block` / `--jg-space-page-inline`.
- Major sections: `--jg-section-gap`.
- Cards/panels: `--jg-card-padding`.
- Forms: `--jg-form-gap`.
- Grids: `--jg-grid-gap`.
- Tables: `--jg-table-cell-block` / `--jg-table-cell-inline`.

Avoid nested cards unless the inner element is an actual record in a list, such as a task card inside a kanban column.

## Icons

UIM (`packages/web/public/icons/uim/*.svg`) is the primary UI icon set. It is used through `appIcon()` / `iconLabel()` in `packages/web/src/html.ts` so SVGs stay local and inline with `currentColor`.

Semantic UI icon mapping:

- Overview: `apps`
- Tasks: `list-ul`
- Boards: `layer-group`
- Automations: `process`
- Schedule: `calendar`
- Agents: `shield-plus`
- Runs/activity: `history`
- Settings: `key-skeleton`
- Create: `plus-square`
- Edit/details: `document-layout-left`
- Delete/failure: `times-circle`
- Run/dispatch: `rocket`
- Save/confirm: `check`
- Usage/model: `analytics` / `graph-bar`

Brand icons from `packages/web/public/icons/simple/*.svg` are allowed only when provider/technology recognition matters (for example OpenAI, Anthropic, GitHub, Slack, Resend, SQLite). Do not use brand icons as general UI decoration.

## Components

Canonical helpers live in `packages/web/src/html.ts`:

- `appIcon`, `iconLabel`
- `pageHeader`
- `section`
- `pageGrid`
- `panel`, `formPanel`
- `card`, `folderCard`
- `toolbar`
- `inlineActions`
- `actionLink`
- `notice`
- `badge`
- `emptyState`
- `table`
- `metaTable`

Prefer these helpers over route-local markup for repeated page structures. Controls must have visible focus, 44px target height where they behave as actions, and explicit labels for form inputs. Status should use text plus a visible marker through `.status-badge`/`.badge`, not color-only spans.

## Motion

Motion is minimal and state-driven. Respect `prefers-reduced-motion` and avoid animation that delays task completion.

## Responsive Behavior

At tablet widths, the sidebar becomes a compact top region. At phone widths, grids collapse to one column, kanban columns stack vertically, focused kanban links remain available, and helper tables render row cards with data labels. No core workflow should require drag/drop.

## Accessibility

Design to WCAG AA. Preserve semantic headings, landmarks, labeled forms, visible focus rings, sufficient contrast, non-color-only state indicators, local SVGs with correct hidden/label behavior, and readable table alternatives on small screens.
