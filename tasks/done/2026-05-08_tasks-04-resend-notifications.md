# Context

## Completion summary

Completed v0 connector primitive with Resend email notifications: skill allowlisted `notify.email`, automation opt-in config, runner-owned action parser/delivery, SQLite connector metadata, web/run inspection, and docs. Smoke tests confirmed both notification send via `niko@send.juttu.co` and no-notification path.

The goal is to extend agenthq from a local scheduled Pi skill runner into the simplest useful version that can communicate outcomes to the user. The communication channel for v0 is Resend email. Notifications should be opt-in and skill-decided: the skill/automation output should indicate whether a notification should be sent, rather than the runner emailing after every successful run. The scope is notifications only, not write-backs to Notion, Slack, Telegram, WhatsApp, or other tools yet.

Architectural direction: keep communication delivery in agenthq/runner rather than building a custom LLM/tool loop or giving every skill direct provider-specific logic. Pi remains the harness. Automations remain markdown files. Skills can define the expected notification decision/output convention, and the runner can parse that convention and deliver through a small Resend notifier adapter when configured via environment variables.

## Brief

Add a minimal notification primitive to agenthq where a scheduled skill can decide whether to send an email notification via Resend. The runner should execute Pi as it does today, store the run, inspect the skill output for a notification decision, and send an email only when requested.

## Relevant Files

- `tasks/spec.md` - Current agenthq architecture and primitive definitions.
- `tasks/vision.md` - Product vision and constraints.
- `tasks/done/2026-05-08_tasks-01-local-mvp.md` - Existing completed MVP task list.
- `automations/*.md` - Automation files that may gain notification configuration.
- `skills/*/SKILL.md` - Skills that may document the notification output convention.
- `packages/runner/src/*` - Runner, parser, DB, and Pi invocation code to extend.
- `packages/runner/src/connectors.ts` - Connector action parser and Resend HTTP adapter.
- `packages/runner/src/skill.ts` - Skill frontmatter metadata loader for allowed intents.
- `packages/web/src/readers.ts` / `packages/web/src/routes.ts` - Run inspection for connector action metadata.
- `.env.example` - Should document Resend-related environment variables.
- `README.md` / `docs/ARCHITECTURE.md` - Setup and architecture docs.

### Notes

- Use Resend for the first communication channel.
- The skill decides whether to notify.
- Scope is notifications only; defer Notion/write-backs and other channels.
- Prefer a deterministic, runner-owned delivery step over provider-specific behavior inside skills.
- Keep config file-based and local-first.

## Tasks

- [x] 1.0 Define the notification contract
  - [x] 1.1 **Clarify:** What exact output convention should a skill use to request a notification?
  - [x] 1.2 Choose a minimal machine-readable block format for Pi output, such as fenced JSON with `notify: true`, `subject`, and `body`.
  - [x] 1.3 Define behavior when no notification block is present: store run output, send nothing.
  - [x] 1.4 Define behavior when a malformed notification block is present: store parse error and send nothing.
  - [x] 1.5 Add the chosen contract to `tasks/spec.md` as the v0 notification primitive.

- [x] 2.0 Extend automation/config model for notifications
  - [x] 2.1 **Clarify:** Which notification fields belong in automation frontmatter versus environment variables?
  - [x] 2.2 Extend automation frontmatter schema with an optional notification config for Resend email.
  - [x] 2.3 Keep secrets in env only, including `RESEND_API_KEY`.
  - [x] 2.4 Decide and document non-secret defaults, likely `notify.email.to` and optional `notify.email.from` / `subjectPrefix`.
  - [x] 2.5 Update `.env.example` with Resend variables and short setup notes.
  - [x] 2.6 Ensure automations without notification config continue to run unchanged.

- [x] 3.0 Implement Resend notifier in the runner
  - [x] 3.1 **Clarify:** Should failed notification delivery fail the run or be recorded as a non-fatal delivery error?
  - [x] 3.2 Add a small notifier module in `packages/runner/src/` that sends email through Resend's HTTP API or SDK.
  - [x] 3.3 Add a parser that extracts the notification decision block from `output_text`.
  - [x] 3.4 Wire notifier execution after Pi exits and after run output is captured.
  - [x] 3.5 Require both automation notification config and a skill-requested notification before sending.
  - [x] 3.6 Handle missing `RESEND_API_KEY` with a clear non-fatal error message.
  - [x] 3.7 Keep Pi as the only agent harness; do not add a separate LLM/tool loop.

- [x] 4.0 Update a sample skill and automation to exercise skill-decided email
  - [x] 4.1 **Clarify:** What real first use case should prove this primitive: daily review, cron job summary, or another automation?
  - [x] 4.2 Update `skills/daily-review/SKILL.md` to explain when to request a notification.
  - [x] 4.3 Update `automations/daily-review.md` or create a new test automation with Resend notification config.
  - [x] 4.4 Add prompt guidance that the skill should only notify when there is a useful user-facing outcome.
  - [x] 4.5 Include an example notification block in the skill documentation.

- [x] 5.0 Persist and inspect notification results
  - [x] 5.1 **Clarify:** Is storing delivery status on the existing `runs` row enough for v0, or should notifications get their own table?
  - [x] 5.2 Add minimal run metadata for notification status, destination, provider message id, and error text.
  - [x] 5.3 Update DB setup/migration logic without breaking existing `data/agenthq.sqlite` files.
  - [x] 5.4 Update any run inspection scripts or README examples to show notification outcome.
  - [x] 5.5 Ensure failed Pi runs do not send normal success notifications unless explicitly designed later.

- [x] 6.0 Document setup and run a smoke test
  - [x] 6.1 **Clarify:** What sender/from address and verified domain will be used for the Resend smoke test?
  - [x] 6.2 Document Resend setup in `README.md` or `tasks/spec.md`: API key, sender, recipient, and cron env considerations.
  - [x] 6.3 Run typecheck/tests for the runner package.
  - [x] 6.4 Run a manual automation where the skill requests no notification and confirm no email is sent.
  - [x] 6.5 Run a manual automation where the skill requests notification and confirm email is sent.
  - [x] 6.6 Confirm the SQLite run row records notification outcome.
