# Readable Run Traces

## Completion Summary

Completed on 2026-05-12. The web run detail page now renders a deterministic readable timeline from raw Pi JSONL traces, with compacted assistant/tool events, resilient raw fallbacks, tests, docs, and web validation complete.

## Goal

Make run detail pages easier to inspect by deriving a deterministic, human-readable event log from the existing Pi JSONL `trace_text`. Keep the raw trace available, but show a compact timeline first so routine runs do not require reading low-level `message_update` deltas.

## Notes

- This is likely simple enough to implement directly: parse existing JSONL trace on read/render and do not add a new DB column unless performance or querying needs appear.
- Preserve `runs.trace_text` as the source of truth and fallback/debug artifact.
- The deterministic projection should be tolerant of malformed lines and unknown Pi event types.
- Prefer grouping noisy streaming events (`message_update` / `text_delta`) instead of showing one row per token.
- Web UI remains raw server-rendered HTML with no frontend framework.

## Relevant Files

- `packages/web/src/routes.ts` - Renders `/runs/:id`; add the readable timeline above raw trace.
- `packages/web/src/readers.ts` - Defines `RunRow`; no storage/schema changes needed.
- `packages/web/src/trace-log.ts` - Pure deterministic JSONL-to-readable-log formatter.
- `packages/web/src/html.ts` - Existing HTML escaping/status helpers; reused for safe rendering.
- `packages/web/public/styles.css` - Timeline/log styling.
- `tests/web/trace-log.spec.ts` - Formatter coverage for compaction and fallback behavior.
- `packages/runner/src/run-log.ts` - Current trace/output accumulation behavior; useful reference for event semantics.
- `packages/runner/src/pi.ts` - Writes Pi JSON events plus runner-owned trace events.
- `docs/ARCHITECTURE.md` - Document that raw traces are displayed with a derived readable timeline.
- `packages/web/DOCS.md` - Update run detail documentation.
- `tasks/CHANGELOG.md` - Record the observability improvement when implemented.

## Tasks

- [x] 1.0 Define the deterministic trace-to-log projection
  - [x] 1.1 Inventory runner-owned event types: `agenthq_run_meta`, `agenthq_pi_start`, `agenthq_stderr`, `agenthq_non_json_stdout`, `agenthq_connector_plan`, `agenthq_connector_action`, `agenthq_connector_actions`, `agenthq_summary`, `agenthq_error`.
  - [x] 1.2 Inventory common Pi event types from stored traces: `session`, `agent_start`, `turn_start`, `message_start`, `message_update`, `message_end`, `turn_end`, `agent_end`, and `tool_execution_*`.
  - [x] 1.3 Define stable display categories such as `run`, `pi`, `session`, `prompt`, `assistant`, `tool`, `connector`, `stderr`, `error`, and `raw`.
  - [x] 1.4 Define compaction rules: suppress individual `text_delta` events, summarize assistant output once from `text_end`/`message_end`, and summarize token/cost data once from the final assistant message.
  - [x] 1.5 Define fallback behavior for malformed JSON and unknown event types: show one muted `raw` entry with the event `type` or line preview.

- [x] 2.0 Implement a pure trace formatter
  - [x] 2.1 Add a small pure helper, e.g. `formatTraceLog(traceText: string): TraceLogEntry[]`, in `packages/web/src/trace-log.ts` or similar.
  - [x] 2.2 Parse `trace_text` line-by-line as JSONL without throwing for bad lines.
  - [x] 2.3 Generate concise entries for run metadata, Pi start, session creation, prompt sent, assistant final output, usage/cost, stderr, connector actions, summary, and errors.
  - [x] 2.4 Include useful metadata where safe: automation, skill, model, cwd, exit code, duration, token counts, cost, connector status.
  - [x] 2.5 Avoid rendering the full prompt or huge assistant text in the timeline; use short previews and keep full output in the existing Output section.

- [x] 3.0 Render readable logs on the run detail page
  - [x] 3.1 Add a `Log` or `Timeline` section above `Output` on `/runs/:id`.
  - [x] 3.2 Render trace log entries as a compact table/list with category, label, and detail.
  - [x] 3.3 Keep the existing `<details><summary>Raw trace</summary>` block unchanged or renamed to clarify it is the raw JSONL source.
  - [x] 3.4 Add minimal CSS for readable spacing and muted metadata.
  - [x] 3.5 Ensure all generated labels/details are escaped before rendering.

- [x] 4.0 Add tests/smoke coverage
  - [x] 4.1 Add unit coverage or a lightweight script fixture for the sample notification-noop trace, verifying noisy deltas compact into a few entries.
  - [x] 4.2 Verify malformed lines and unknown event types render as fallback entries instead of breaking the page.
  - [x] 4.3 Run `pnpm validate:web` and inspect the run detail page output.
  - [~] 4.4 If runner code is touched, run `pnpm validate:backend` only when local Pi auth/provider availability is expected. - Skipped: runner/backend code was not changed.

- [x] 5.0 Update docs and task history
  - [x] 5.1 Update `packages/web/DOCS.md` to say run detail shows a derived readable log plus raw trace.
  - [x] 5.2 Update `docs/ARCHITECTURE.md` to describe the derived trace view without introducing a normalized tracing schema.
  - [x] 5.3 Update `tasks/CHANGELOG.md` after implementation.

## Decisions

- Use an on-read deterministic projection from JSONL to log entries first; do not create a new ticket/schema for normalized tracing unless later requirements need querying, filtering, or durable event categories.
- Keep raw trace as the canonical stored artifact.
