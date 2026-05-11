# Browser Pi Chat — Lean Sandboxed Direction

## Goal

Add a lean browser UI for interacting with a server-side Pi session, while preparing for sandboxed Pi sessions that operate agenthq through a narrow domain/API surface instead of direct app filesystem access.

The first implementation should stay small: keep server-rendered HTML, avoid SQLite persistence for chat, and avoid a frontend rewrite. The main architectural move is to extract shared domain services so existing HTML routes, a future JSON API, and Pi-facing tools can reuse the same validated operations.

## Notes

- Pi must run server-side; do not attempt browser-native Pi.
- Browser Pi should not require direct access to the agenthq repo/app filesystem long-term.
- Prefer Pi RPC mode or SDK over building a custom LLM/tool loop.
- Keep chat/session state in-memory for MVP; no SQLite persistence for chat messages/events.
- Keep existing raw HTML/server-rendered frontend. Do not migrate the frontend to client-side API calls yet.
- Existing HTML routes should call shared domain services directly.
- Future Pi tools/API should call the same domain services.
- Expose domain-specific operations only; avoid generic `write_file` or `bash` access to the app.
- Treat this as local/private only until auth, sandboxing, and capability controls exist.

## Relevant Files

- `docs/ARCHITECTURE.md` - Current runtime and web viewer boundaries.
- `packages/web/DOCS.md` - Web routes, constraints, and validation expectations.
- `packages/web/src/actions.ts` - Existing mutation logic to extract/reuse as domain services.
- `packages/web/src/readers.ts` - Existing read logic to extract/reuse as domain services.
- `packages/web/src/routes.ts` - Existing HTML routes; should use shared services and add `/pi` page.
- `packages/web/src/index.ts` - Server wiring; may need SSE/WebSocket lifecycle hooks.
- `packages/web/src/html.ts` - Shared layout and escaping helpers.
- `packages/web/public/styles.css` - Minimal styling for the chat UI.
- `packages/runner/src/pi.ts` - Existing Pi spawning behavior; useful reference for server-side Pi integration.
- `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/docs/rpc.md` - Pi RPC protocol reference if using RPC mode.
- `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/docs/sdk.md` - Pi SDK reference if using the SDK.

## Tasks

- [ ] 1.0 Extract a shared agenthq domain service layer
  - [ ] 1.1 Identify existing read/write operations in `packages/web/src/readers.ts` and `packages/web/src/actions.ts`.
  - [ ] 1.2 Create shared service functions for skills: list, read, create, update, delete.
  - [ ] 1.3 Create shared service functions for automations: list, read, create, update, delete, run now.
  - [ ] 1.4 Create shared service functions for runs: list recent and read detail.
  - [ ] 1.5 Keep validation and safe file writes inside the service layer, not in route handlers.
  - [ ] 1.6 Update existing server-rendered HTML routes to call the shared services directly.

- [ ] 2.0 Define the future Pi-facing operation surface
  - [ ] 2.1 Document a small set of allowed domain operations for Pi: skills CRUD, automations CRUD, run automation, read recent runs.
  - [ ] 2.2 Include connector setup as non-secret configuration only; secrets remain outside Pi-facing tools.
  - [ ] 2.3 Explicitly exclude generic filesystem write and arbitrary shell access to the agenthq app.
  - [ ] 2.4 Add notes for future capability checks/tokens before any non-local exposure.

- [ ] 3.0 Add a minimal local JSON API only where useful
  - [ ] 3.1 Add JSON endpoints for the small domain surface if needed by the Pi integration.
  - [ ] 3.2 Reuse the shared service layer for all JSON handlers.
  - [ ] 3.3 Keep existing HTML pages server-rendered; do not rewrite them to fetch from the API.
  - [ ] 3.4 Keep the API local/private and document that it is not yet public-safe.

- [ ] 4.0 Choose and prototype the Pi chat integration path
  - [ ] 4.1 Read Pi `docs/rpc.md` and `docs/sdk.md` enough to compare fit for a web chat session.
  - [ ] 4.2 Decide between RPC and SDK for this MVP, favoring the smallest reliable implementation.
  - [ ] 4.3 Create an in-memory server-side session manager keyed by generated session id.
  - [ ] 4.4 Support sending one user message at a time to a Pi session.
  - [ ] 4.5 Stream assistant/tool/status events back to the browser via SSE or a similarly small mechanism.
  - [ ] 4.6 Add explicit stop/cleanup handling for idle sessions, failed sessions, and server shutdown.

- [ ] 5.0 Add a minimal browser chat UI
  - [ ] 5.1 Add `GET /pi` with a simple server-rendered chat page.
  - [ ] 5.2 Add a prompt textarea/input and send button with minimal client-side JavaScript for streaming.
  - [ ] 5.3 Render streamed assistant text incrementally.
  - [ ] 5.4 Render basic non-text events such as tool calls, errors, and completion in a readable way.
  - [ ] 5.5 Add a “stop session” or “new session” control.

- [ ] 6.0 Keep scope intentionally narrow and safe
  - [ ] 6.1 Do not write Pi chat messages or events to SQLite.
  - [ ] 6.2 Do not add auth, multi-user accounts, or public deployment assumptions.
  - [ ] 6.3 Do not implement a full terminal emulator or xterm.js UI.
  - [ ] 6.4 Do not expose arbitrary workspace selection beyond safe local defaults.
  - [ ] 6.5 Document that real sandboxing/containerization is required before exposing browser Pi beyond trusted local access.

- [ ] 7.0 Validate and update docs
  - [ ] 7.1 Update `packages/web/DOCS.md` with the shared service/API direction and new `/pi` route.
  - [ ] 7.2 Add or update a lightweight web validation check for the `/pi` page if feasible without invoking a real model.
  - [ ] 7.3 Run `pnpm validate:web` and inspect Playwright output.
  - [ ] 7.4 If backend integration was touched outside web, run `pnpm validate:backend` only if local Pi auth/provider availability is expected.
