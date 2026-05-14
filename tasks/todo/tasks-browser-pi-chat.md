# Pi Chat Gateway — Browser + Slack Direction

## Goal

Add a lean server-side Pi chat gateway that can serve a local browser chat UI now and a Slack bot adapter next. The important architectural unit is a shared chat gateway, not a browser-only page: platform adapters normalize inbound messages, a session manager owns server-side Pi sessions, and outbound delivery adapters send assistant/tool/status events back to the originating surface.

Longer term, sandboxed Pi sessions should operate agenthq through a narrow domain/API/tool surface instead of direct app filesystem or shell access.

## Product Stance

agenthq should be the stripped-down, higher-observability cousin of Hermes/OpenClaw: fewer features, fewer moving parts, minimal LOC, strong primitives, open source extensibility, and strong run/task observability. Where Hermes/OpenClaw have broad personal-agent capabilities, agenthq should focus on the smallest useful agent operations layer: file-native agents, scheduled/triggered tasks, connector-gated actions, auditable runs, and a safe chat gateway for operating that surface.

The workspace/core restructure is tracked separately in `tasks/todo/tasks-workspace-restructure.md` and should land before this gateway work.

## Critical Review

The previous browser-first plan is directionally useful but under-scoped for Slack exposure:

- A `/pi` browser page alone creates the wrong seam. Slack needs the same message/session/delivery lifecycle without depending on browser HTTP/SSE code.
- Extracting domain services is still the right first move. Pi-facing tools, HTML routes, JSON handlers, browser chat, and Slack should all reuse the same validated operations.
- Chat state can remain in memory for the first local prototype, but the code should define a `SessionStore` interface now. Slack bots are long-lived and restart-prone; Hermes persists gateway sessions, so agenthq should not bake in browser-only ephemeral assumptions.
- Slack exposure is not “local/private.” Even with Socket Mode and no public HTTP endpoint, remote Slack users can drive the agent. Deny-by-default allowlists, mention gating, command gating, and tool capability restrictions are mandatory for any Slack adapter.
- Avoid a public generic JSON API. If an API is needed, keep it local/private and domain-specific. For Pi, prefer SDK custom tools/domain services directly for MVP; keep an RPC-backed implementation possible behind an interface for process isolation.
- Do not let Slack-triggered Pi sessions have default coding-agent `bash`/`write` access to the agenthq app. Start with domain-only custom tools and possibly read-only tools in a sandbox workspace.
- The chat should eventually be able to modify the “software’s behavior” by editing user-owned agenthq content — agents, automations, tasks/projects, connector config metadata, schedules — but not the core application source (`packages/`, runner/web/gateway internals, package scripts, lockfiles, etc.). Treat this as controlled product-surface editing, not general repo coding access.
- A single mutable workspace root makes sandboxing and chat-safe editing simpler. Since agenthq is not deployed yet, prefer doing the small restructure now rather than carrying top-level mutable paths forever.
- Hermes separates core app code from user-owned state under `~/.hermes/`; agenthq should consider a similar split while staying file-native and repo-friendly. The key is not copying Hermes' breadth, but adopting the boundary: core software is immutable to chat, user/task content is editable through safe domain operations.

## Hermes Agent Research Notes

Hermes is a useful reference model for a chat gateway:

- It runs a single long-lived gateway process with platform adapters, a session store, and delivery routing: `GatewayRunner -> platform adapters -> _handle_message() -> AIAgent -> SessionStore`.
- Each adapter normalizes platform events into a common message event shape, then responses are routed back through the same platform adapter.
- Session keys encode platform/chat/thread context, e.g. `agent:main:{platform}:{chat_type}:{chat_id}`. Thread-aware platforms include thread IDs; shared vs per-user group sessions are configurable.
- It uses a two-level busy-session guard: adapters queue/interrupt while a session is active, and the runner still allows bypass commands such as `/stop`, `/new`, `/queue`, `/status`, `/approve`, and `/deny`.
- Authorization is deny-by-default: platform allowlists, optional pairing, optional allow-all only when explicitly configured, and separate slash-command access tiers.
- Slack uses Bolt Socket Mode (`xoxb-` bot token + `xapp-` app-level token), so no public HTTP endpoint is required. DMs respond directly; channels require `@mention` to start and reply in threads; active threads can continue without repeated mentions.
- Slack setup needs scopes/events such as `chat:write`, `app_mentions:read`, `channels:history`, `groups:history`, `im:history`, `message.im`, `message.channels`, `message.groups`, and `app_mention`.
- Hermes treats native Slack slash commands as command events, but a lean MVP can parse chat commands first and add native slash commands later.
- Slack streaming is implemented as platform-specific progressive updates/edits where possible; final-only replies are acceptable for an MVP if browser SSE handles true streaming locally.

Research sources:

- Hermes gateway internals: https://hermes-agent.nousresearch.com/docs/developer-guide/gateway-internals
- Hermes messaging guide: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/
- Hermes Slack guide: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/slack
- Hermes Slack adapter: https://github.com/NousResearch/hermes-agent/blob/main/gateway/platforms/slack.py
- Pi RPC docs: `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/docs/rpc.md`
- Pi SDK docs: `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/docs/sdk.md`
- Pi extensions/custom tools docs: `/opt/homebrew/lib/node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`

## Decisions for MVP

- Treat the gateway core as the reusable abstraction; browser and Slack are adapters.
- Use Pi server-side only.
- Prefer the Pi SDK first because this repo is TypeScript, SDK gives typed event subscriptions and custom tools, and domain services can be registered directly as custom tools. Keep a `PiSessionDriver` boundary so RPC can replace it if process isolation becomes more important.
- Keep chat messages/events out of agenthq runs SQLite for MVP.
- Define session persistence as an interface; start in-memory but do not couple the design to it.
- Use Slack Socket Mode rather than exposing a public webhook endpoint.
- Deny all Slack users by default unless explicitly allowlisted.
- Restrict Slack-accessible Pi tools to domain operations; exclude arbitrary shell and generic filesystem writes.
- Model the editable surface as “agenthq workspace,” not “the repository.” For MVP, allow validated edits only under `agents/`, `automations/`, and `projects/` inside the workspace through services/tools; keep core source read-only or invisible to chat-driven Pi sessions.
- Prefer a Hermes-like state boundary over a Hermes-like feature set: a mutable `workspace/` / `AGENTHQ_HOME` for user/task state, a small core package for runner/web/gateway logic, and connector/domain tools as the only mutation path.
- Recommended layout: `workspace/{agents,automations,projects,data,workspaces,traces}` for local development, with `AGENTHQ_HOME` overriding `workspace/` for deployment. Yes, `workspace/workspaces` is a little awkward; it preserves the existing term “workspace” for per-automation Pi cwd while making the top-level boundary obvious.
- Add a workspace-root/path-policy seam before any direct file-style editing. If we later want Pi to use file-like tools, run it with a cwd that only contains allowed workspace files or provide custom path-guarded tools that cannot escape allowed directories.

## Non-Goals Now

- Browser-native Pi.
- A custom LLM/tool loop.
- Public unauthenticated web dashboard.
- Full Slack native slash-command manifest generation.
- Multi-platform gateway beyond browser + Slack.
- Full terminal emulator/xterm UI.
- Arbitrary workspace selection from Slack.
- Attachment/image/voice support in the first Slack adapter.

## Relevant Files

- `docs/ARCHITECTURE.md` - Current runtime and web viewer boundaries.
- `packages/web/DOCS.md` - Web routes, constraints, and validation expectations.
- `packages/web/src/actions.ts` - Existing mutation logic to extract/reuse as domain services.
- `packages/web/src/readers.ts` - Existing read logic to extract/reuse as domain services.
- `packages/web/src/routes.ts` - Existing HTML routes; should use shared services and add local `/pi` page.
- `packages/web/src/index.ts` - Server wiring; may need local browser SSE lifecycle hooks.
- `packages/web/src/html.ts` - Shared layout and escaping helpers.
- `packages/web/public/styles.css` - Minimal browser chat styling.
- `packages/runner/src/pi.ts` - Existing Pi spawning behavior and JSON event parsing reference.
- `packages/runner/src/connectors/` - Existing runner-owned external connector/tool pattern.
- `tasks/todo/tasks-workspace-restructure.md` - Prerequisite ticket for the workspace/core path split.
- `packages/gateway/src/` - Proposed gateway core + platform adapters.
- `packages/gateway/src/pi-session.ts` - Proposed Pi SDK/RPC session driver boundary.
- `packages/gateway/src/adapters/browser.ts` - Proposed browser adapter/SSE bridge if not kept inside web.
- `packages/gateway/src/adapters/slack.ts` - Proposed Slack Socket Mode adapter.
- `packages/gateway/src/session-store.ts` - Proposed in-memory session store with persistence-ready interface.
- `packages/gateway/src/domain-tools.ts` - Proposed Pi custom tools wrapping agenthq domain services.

## Tasks

- [ ] 1.0 Extract a shared agenthq domain service layer
  - [ ] 1.1 Identify existing read/write operations in `packages/web/src/readers.ts` and `packages/web/src/actions.ts`.
  - [ ] 1.2 Create shared service functions for agents: list, read, create, update, delete.
  - [ ] 1.3 Create shared service functions for automations: list, read, create, update, delete, run now.
  - [ ] 1.4 Create shared service functions for runs: list recent and read detail.
  - [ ] 1.5 Keep validation and safe file writes inside the service layer, not in route handlers.
  - [ ] 1.6 Update existing server-rendered HTML routes to call the shared services directly.
  - [ ] 1.7 Build on the workspace-root/path-policy from `tasks-workspace-restructure.md`.
  - [ ] 1.8 Keep the service layer as the only writer for agents, automations, and tasks/projects, so future Pi/chat tools can edit those files without gaining repo-wide write access.

- [ ] 2.0 Define the chat gateway core contracts
  - [ ] 2.1 Define a normalized inbound `ChatMessageEvent` with platform, team/workspace, chat id, thread id, user id, text, and message id.
  - [ ] 2.2 Define a `DeliveryAdapter` interface for sending final messages, streaming/status updates, errors, and private notices where supported.
  - [ ] 2.3 Define a `ChatSessionManager` keyed by deterministic session keys such as `pi:{platform}:{workspace}:{chatType}:{chatId}:{threadId?}:{userId?}`.
  - [ ] 2.4 Define an in-memory `SessionStore` implementation plus an interface for future durable storage.
  - [ ] 2.5 Add busy-session behavior: reject, queue/follow-up, steer, or stop; start with simple one-message-at-a-time plus explicit `/stop`.
  - [ ] 2.6 Add gateway commands for `/new`, `/stop`, `/status`, and `/help` before adding platform-native slash commands.
  - [ ] 2.7 Add idle cleanup and shutdown cleanup for all active Pi sessions.

- [ ] 3.0 Implement the Pi session driver behind a narrow interface
  - [ ] 3.1 Create a `PiSessionDriver` interface with `sendMessage`, `stop`, `newSession`, `getState`, event subscription, and `dispose`.
  - [ ] 3.2 Prototype the driver with the Pi SDK (`createAgentSession` / `AgentSession`) and map Pi events to gateway events.
  - [ ] 3.3 Configure the SDK session with domain-only custom tools for Slack-exposed sessions; do not enable default `bash`, `write`, or generic app filesystem tools.
  - [ ] 3.4 Keep an RPC driver option documented for future process isolation or sandboxed subprocess execution.
  - [ ] 3.5 Convert Pi `message_update`, tool, queue, completion, abort, and error events into UI/platform-safe gateway events.
  - [ ] 3.6 Add explicit handling for extension UI requests if enabled; otherwise avoid extensions/tools that require interactive dialogs.

- [ ] 4.0 Define the Pi-facing operation surface and capabilities
  - [ ] 4.1 Document allowed domain operations for Pi: agents CRUD, automations CRUD, tasks/projects CRUD/status transitions, run automation, read recent runs.
  - [ ] 4.2 Include connector setup as non-secret configuration only; secrets remain outside Pi-facing tools.
  - [ ] 4.3 Explicitly exclude generic filesystem write and arbitrary shell access to the agenthq app for Slack/browser chat sessions.
  - [ ] 4.4 Add a simple capability policy object per session/platform before any non-local adapter is enabled.
  - [ ] 4.5 Add audit-friendly structured logs for user id, platform, command, tool name, and outcome without logging secrets.
  - [ ] 4.6 Define “editable by chat” as agents, automations, tasks/projects, and safe non-secret configuration only; explicitly exclude core app source, dependency manifests, lockfiles, scripts, and environment files.
  - [ ] 4.7 Treat `workspace/` / `AGENTHQ_HOME` as the mutable root after `tasks-workspace-restructure.md` lands.
  - [ ] 4.8 If direct file-style tools are ever exposed, implement custom path-guarded read/edit/write tools scoped to the workspace root instead of Pi's generic repo-level tools.

- [ ] 5.0 Add the minimal local browser adapter
  - [ ] 5.1 Add `GET /pi` with a simple server-rendered local chat page.
  - [ ] 5.2 Add a prompt textarea/input and send button with minimal client-side JavaScript.
  - [ ] 5.3 Stream assistant text and basic tool/status events back to the browser via SSE.
  - [ ] 5.4 Render tool calls, errors, queue state, and completion in a readable minimal format.
  - [ ] 5.5 Add “stop” and “new session” controls wired through the gateway core.
  - [ ] 5.6 Keep the browser route local/private; do not require client-side API rewrite of existing HTML pages.

- [ ] 6.0 Add a lean Slack Socket Mode adapter
  - [ ] 6.1 Add optional Slack dependencies and env config for `AGENTHQ_SLACK_BOT_TOKEN`, `AGENTHQ_SLACK_APP_TOKEN`, and `AGENTHQ_SLACK_ALLOWED_USERS`.
  - [ ] 6.2 Connect with Slack Socket Mode so agenthq does not need a public HTTP endpoint.
  - [ ] 6.3 Subscribe to DMs, app mentions, and channel/private-channel messages where the bot is invited.
  - [ ] 6.4 Implement deny-by-default user authorization using Slack Member IDs.
  - [ ] 6.5 In DMs, respond to all authorized messages; in channels, require `@mention` to start a session.
  - [ ] 6.6 Reply in Slack threads for channel conversations and use thread id in the session key.
  - [ ] 6.7 Continue active thread sessions without requiring repeated mentions unless strict mention mode is enabled later.
  - [ ] 6.8 Start with final-message delivery plus coarse status messages; add throttled `chat.update` streaming only after the core works.
  - [ ] 6.9 Parse `/new`, `/stop`, `/status`, and `/help` as chat commands; defer native Slack slash-command manifest generation.
  - [ ] 6.10 Document required Slack scopes/events and the “invite bot to channel” setup checklist.

- [ ] 7.0 Keep scope intentionally narrow and safe
  - [ ] 7.1 Do not write Pi chat messages/events to the existing runs SQLite table.
  - [ ] 7.2 Do not add multi-user accounts or public web deployment assumptions.
  - [ ] 7.3 Do not implement a full terminal emulator or xterm.js UI.
  - [ ] 7.4 Do not expose arbitrary workspace selection beyond safe local defaults.
  - [ ] 7.5 Do not enable Slack unless allowlist and restricted tool capability checks are active.
  - [ ] 7.6 Document that real sandboxing/containerization is required before granting broader file/shell access to chat-driven Pi sessions.
  - [ ] 7.7 Never expose chat-driven editing of `packages/`, `.github/`, package manifests, lockfiles, `.env*`, or other core/runtime-sensitive files without a separate admin-only coding mode and stronger sandboxing.

- [ ] 8.0 Validate and update docs
  - [ ] 8.1 Update `packages/web/DOCS.md` with the gateway/browser direction and new `/pi` route.
  - [ ] 8.2 Add gateway docs covering Slack Socket Mode setup, env vars, allowlist, command behavior, and safety constraints.
  - [ ] 8.2a Document the product positioning: minimal open-source B2B automation runner with strong observability, not a general personal-agent clone.
  - [ ] 8.3 Add fake-driver tests or smoke checks for gateway session routing without invoking a real model.
  - [ ] 8.4 Add a lightweight web validation check for the `/pi` page if feasible without invoking a real model.
  - [ ] 8.5 Run `pnpm validate:web` after browser/web changes and inspect Playwright output.
  - [ ] 8.6 Run backend/gateway validation with a fake Pi driver by default; only run real Pi validation when local Pi auth/provider availability is expected.
