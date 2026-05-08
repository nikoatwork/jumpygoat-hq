# Web CRUD for Automations and Skills

## Goal

Add lean, file-native CRUD support to the minimal web UI for automations first, with cautious skill authoring support. Preserve the existing architecture: server-rendered HTML, no frontend framework, plain markdown files as the source of truth, and local/private deployment assumptions.

## Completion Summary

Implemented lean server-rendered CRUD for automations and cautious raw skill authoring. Added form parsing, validation, canonical automation serialization, atomic writes, guarded deletes, docs updates, and manual route/action smoke checks. Cron install/uninstall controls remain deferred.

## Notes

- Automations are single markdown files in `automations/<name>.md` with YAML frontmatter and prompt body.
- Skills live in `skills/<name>/SKILL.md` and should remain close to Pi/Agent Skills format.
- Keep validation small but strict around file paths, names, required fields, schedule format, and skill existence.
- Prefer boring server-rendered forms and POST-redirect flows over client-side app architecture.
- Do not add a database-backed CMS or second source of truth.
- Browser mutation increases risk; keep local bind defaults and aggressively prevent path traversal.

## Relevant Files

- `docs/ARCHITECTURE.md` - Current architecture, route inventory, and boundaries.
- `packages/web/DOCS.md` - Web package purpose, current routes, and minimal UI constraints.
- `packages/web/src/routes.ts` - Existing route handlers to extend with form pages and mutation endpoints.
- `packages/web/src/index.ts` - POST body parsing for form submissions.
- `packages/web/src/actions.ts` - Current mutation layer; should own create/update/delete actions.
- `packages/web/src/readers.ts` - Existing file/db readers; useful for listing skills and automations.
- `packages/web/src/html.ts` - Layout and escaping helpers for server-rendered forms.
- `packages/web/src/paths.ts` - Path resolution guardrails should be reused/extended.
- `automations/README.md` - Automation file contract.
- `skills/README.md` - Skill file contract.
- `tasks/CHANGELOG.md` - Update when implementation is completed.

## Tasks

- [x] 1.0 Define the lean CRUD contract
  - [x] 1.1 Confirm automation CRUD scope: create, edit, delete, view, run now.
  - [x] 1.2 Confirm skill CRUD scope: list/view, create from template, raw `SKILL.md` edit, delete only when unused.
  - [x] 1.3 Decide whether cron install/uninstall controls are included now or deferred to a follow-up.
  - [x] 1.4 Document that files remain the source of truth and the web UI is only a safe convenience layer.

- [x] 2.0 Add shared validation and file-writing primitives
  - [x] 2.1 Add slug validation for automation and skill names: no path traversal, no nested paths, no unsafe characters.
  - [x] 2.2 Add automation input validation: existing skill, non-empty prompt, schedule is `manual` or valid 5-field cron, optional model string.
  - [x] 2.3 Add skill input validation: non-empty content, safe name, `SKILL.md` target path, optional frontmatter parse check if practical.
  - [x] 2.4 Add canonical automation markdown serialization from validated form fields.
  - [x] 2.5 Use atomic write behavior where practical: temp file then rename.
  - [x] 2.6 Ensure delete operations cannot escape `automations/` or `skills/`.

- [x] 3.0 Implement automation CRUD in the web UI
  - [x] 3.1 Add `GET /automations/new` form with name, skill dropdown, schedule, model, and prompt.
  - [x] 3.2 Add `POST /automations` to validate and create `automations/<name>.md`.
  - [x] 3.3 Add `GET /automations/:name/edit` form populated from the existing markdown file.
  - [x] 3.4 Add `POST /automations/:name` to validate and update the existing automation file.
  - [x] 3.5 Add `POST /automations/:name/delete` with a confirmation step or explicit confirmation field.
  - [x] 3.6 Preserve existing Run now behavior after CRUD changes.
  - [x] 3.7 Render validation errors inline without losing submitted form values.

- [x] 4.0 Implement cautious skill authoring support
  - [x] 4.1 Add skill detail/view page if not already sufficient from the list page.
  - [x] 4.2 Add `GET /skills/new` with a minimal `SKILL.md` template.
  - [x] 4.3 Add `POST /skills` to create `skills/<name>/SKILL.md`.
  - [x] 4.4 Add `GET /skills/:name/edit` raw markdown editor for `SKILL.md`.
  - [x] 4.5 Add `POST /skills/:name` to update `SKILL.md` after validation.
  - [x] 4.6 Add skill delete only if no automation references the skill.
  - [x] 4.7 Clearly label skill editing as advanced/system-prompt-like editing.

- [x] 5.0 Keep routing and actions boring
  - [x] 5.1 Keep all mutations as POST endpoints with redirect-after-post on success.
  - [x] 5.2 Keep pages server-rendered with existing HTML helpers.
  - [x] 5.3 Avoid adding frontend frameworks, client-side routing, ORMs, or CMS abstractions.
  - [x] 5.4 Ensure all user-rendered content is escaped.

- [x] 6.0 Add tests/manual verification for safety-critical paths
  - [x] 6.1 Verify create/edit/delete automation round trips preserve valid markdown format.
  - [x] 6.2 Verify invalid names like `../x`, nested paths, spaces, and shell-like strings are rejected.
  - [x] 6.3 Verify automation cannot reference missing skill.
  - [x] 6.4 Verify manual and cron schedules validate correctly.
  - [x] 6.5 Verify skill delete is blocked when referenced by an automation.
  - [x] 6.6 Verify existing dashboard, automations list, skills list, runs list, run detail, and Run now routes still work.

- [x] 7.0 Update docs and changelog
  - [x] 7.1 Update `packages/web/DOCS.md` with new CRUD routes and safety constraints.
  - [x] 7.2 Update `docs/ARCHITECTURE.md` current boundaries to remove or revise “No browser editing of automations.”
  - [x] 7.3 Update `automations/README.md` if the canonical serialized format changes or becomes stricter.
  - [x] 7.4 Update `skills/README.md` with web authoring caveats if skill CRUD ships.
  - [x] 7.5 Update `tasks/CHANGELOG.md` when implementation is complete.
