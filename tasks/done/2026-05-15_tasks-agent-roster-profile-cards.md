# Agent Roster Profile Cards

## Goal

Improve `http://100.74.135.81:3000/agents` so the agents page feels like a team roster instead of an explainer page. Remove the `How to think about agents` section, redesign each agent card as a profile card with an icon/avatar, and keep the implementation aligned with the minimal raw HTML web UI.

## Completion Summary

Completed on 2026-05-15. The Agents page now skips the explainer section and shows profile-style roster cards with deterministic emoji avatars, compact workload stats, preserved edit/delete actions, and passing web validation.

## Notes

- Installed `pbakaus/impeccable` globally with `npx skills add pbakaus/impeccable --global --yes`; it was symlinked for Pi.
- Impeccable context files are not present (`PRODUCT.md`/`DESIGN.md`), so use the product UI register and existing jumpyGoat visual language.
- Theme scene: operator is scanning a local agent ops roster on a desktop during active planning, so keep the current focused dark product UI and prioritize fast recognition over decoration.
- Use emojis as the first version of agent icons unless a real asset field is introduced later.
- Follow existing constraints: raw HTML/CSS, no frontend framework, local validation with `pnpm validate:web` after changes.

## Relevant Files

- `packages/web/src/routes.ts` - Renders the `/agents` page, current explainer section, and current agent card markup.
- `packages/web/public/styles.css` - Defines `.agent-grid`, `.agent-card`, `.agent-facts`, and page visual treatment.
- `packages/web/src/readers.ts` - Shapes `AgentView`; may need a backend-facing field if agent icons become user-configurable instead of derived.
- `packages/web/DOCS.md` - Update if page behavior or agent metadata support changes.
- `tasks/CHANGELOG.md` - Update when implementation is complete.

## Tasks

- [x] 1.0 Remove the explainer section
  - [x] 1.1 Delete the `section("How to think about agents", ...)` block from `agentsPage`.
  - [x] 1.2 Confirm the page still has a clear purpose through the page header and roster section.
  - [x] 1.3 Remove any now-unused styling only if it is not shared by the dashboard concept cards.

- [x] 2.0 Shape the profile-card roster UX
  - [x] 2.1 Define the card anatomy: emoji avatar, agent name, short role/description, status badge when needed, assignment/context facts, primary action, secondary actions.
  - [x] 2.2 Make the roster scan like a team: stronger avatar/name grouping, less list-like facts, and clearer action hierarchy.
  - [x] 2.3 Keep product UI restraint: no gradient text, no side-stripe accents, no decorative animation, no nested cards.
  - [x] 2.4 Ensure empty state still works when there are no agents.

- [x] 3.0 Add deterministic per-agent icons
  - [x] 3.1 Implement a small helper in `packages/web/src/routes.ts` that maps agent names/descriptions to stable emoji icons.
  - [x] 3.2 Include a safe fallback emoji for unknown or sparse agents.
  - [x] 3.3 Decide if icons should remain derived for MVP or become editable metadata later.
  - [~] 3.4 If editable icons are needed now, extend the agent data flow carefully through core/web readers and update create/edit forms. Skipped: derived icons are enough for this MVP pass.

- [x] 4.0 Implement the new agent card markup
  - [x] 4.1 Replace the current `.agent-card` header with profile-card markup using an avatar element.
  - [x] 4.2 Rework facts into compact stats, for example automations, open tasks, context notes.
  - [x] 4.3 Make `View details` the primary card action and keep edit/delete available without dominating the card.
  - [x] 4.4 Preserve warnings and delete confirmation behavior.

- [x] 5.0 Polish responsive CSS
  - [x] 5.1 Tune `.agent-grid` breakpoints/min widths so cards look good from mobile to desktop.
  - [x] 5.2 Add profile-card classes for avatar sizing, identity row, stats, and actions.
  - [x] 5.3 Verify hover/focus states and keyboard accessibility for all links, summaries, and buttons.
  - [x] 5.4 Check descriptions wrap cleanly and long agent names do not break layout.

- [x] 6.0 Validate and document
  - [x] 6.1 Run `pnpm validate:web` and inspect Playwright output.
  - [~] 6.2 Manually review `/agents` with several agents and with an empty roster if practical. Skipped: no browser visual session available; Playwright smoke coverage passed.
  - [~] 6.3 Update `packages/web/DOCS.md` if metadata, behavior, or routes changed. Skipped: no route, API, or editable metadata contract changed.
  - [x] 6.4 Update `tasks/CHANGELOG.md`, then archive this task to `tasks/done/` when complete.
