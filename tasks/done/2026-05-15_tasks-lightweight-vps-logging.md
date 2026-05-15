# Lightweight VPS Logging

## Goal

Introduce dependency-free operational logging so an SSH-only VPS install leaves enough evidence to debug crashes, failed runs, failed cron/systemd jobs, and unusual web/API behavior. Logs should be plain files under the instance home, complement journald/systemd, and avoid secrets by default.

## Completion Summary

Completed on 2026-05-15. Added dependency-free JSONL logging under `$JUMPYGOATHQ_HOME/data/logs/`, instrumented web/API/runner/Pi subprocess paths, improved cron wrapper timestamps, documented SSH-first VPS troubleshooting, and validated web/backend flows.

## Notes

- No external logging dependency; uses Node built-ins only.
- Logs are easy to inspect with `tail`, `grep`, `less`, and `journalctl`.
- Append-only JSONL file logs complement concise console output for systemd/journald.
- Runtime logs belong under `jumpyGoatHqHome()/data/logs/` or `JUMPYGOATHQ_LOG_DIR`, not the source checkout.
- Full prompts, API keys, auth headers, `.env` values, and large Pi trace payloads are not logged by the operational logger; runs already store detailed output/error/trace in SQLite.
- Cron logs remain under `$JUMPYGOATHQ_HOME/data/cron-*.log` and now include wrapper start/end evidence.
- Retention is manual for v1; docs call out archiving/truncating old logs on small VPS disks.

## Relevant Files

- `packages/shared/logger.js` - Dependency-free JSONL logger implementation.
- `packages/shared/logger.d.ts` - Logger TypeScript declarations for package imports.
- `packages/runner/src/index.ts` - Runner CLI startup/catch-all failure logging.
- `packages/runner/src/execute.ts` - Runner lifecycle, run id, DB path, status, errors.
- `packages/runner/src/pi.ts` - Pi subprocess start/exit/stderr evidence.
- `packages/runner/src/run-log.ts` - Existing per-run output/error/trace accumulation.
- `packages/web/src/index.ts` - Web server request, startup, shutdown, and crash logging.
- `packages/web/src/api.ts` - API audit side-effect logging to `web.jsonl`.
- `scripts/cron-utils.ts` - Cron log file generation and timestamped wrapper prologue/epilogue.
- `docs/DEPLOY.md` - Operator docs for log paths, `journalctl`, `tail`, and common failure checks.
- `docs/UPDATE.md` - Update troubleshooting mentions new log files.
- `tasks/CHANGELOG.md` - Canonical completion changelog.

## Tasks

- [x] 1.0 Define logging contract and file layout
  - [x] 1.1 Use `$JUMPYGOATHQ_HOME/data/logs/` as the canonical log directory.
  - [x] 1.2 Define log files: `web.jsonl`, `runner.jsonl`, `cron-<name>.log`/existing, `task-dispatch.log`/existing, and optional `errors.jsonl` for cross-process high-signal failures.
  - [x] 1.3 Define common fields: `ts`, `level`, `component`, `event`, `run_id`, `source_type`, `source_id`, `agent`, `status`, `exit_code`, `duration_ms`, `message`, and small sanitized details.
  - [x] 1.4 Decide local retention policy: manual cleanup/archive for v1, documented in deploy docs.

- [x] 2.0 Add dependency-free logger utility
  - [x] 2.1 Add a small logger module using `fs.appendFileSync`, `mkdirSync`, and `console` only.
  - [x] 2.2 Support levels `debug`, `info`, `warn`, `error` with `JUMPYGOATHQ_LOG_LEVEL` defaulting to `info`.
  - [x] 2.3 Support `JUMPYGOATHQ_LOG_DIR` override, defaulting to `data/logs` under the active instance home.
  - [x] 2.4 Serialize each file event as one JSON line and fall back to stderr if file writing fails.
  - [x] 2.5 Add a sanitizer helper for known secret-ish keys and oversized strings.

- [x] 3.0 Instrument the web service
  - [x] 3.1 Log startup with host, port, DB path, instance home, Node version, and pid.
  - [x] 3.2 Log shutdown signals and server close completion.
  - [x] 3.3 Log request completion to `web.jsonl` with method, path, status, duration, and route type; exclude query secrets/body/header values.
  - [x] 3.4 Log handled request errors with stack/message to `web.jsonl` and `errors.jsonl`.
  - [x] 3.5 Add `process.on("uncaughtException")` and `process.on("unhandledRejection")` handlers that log before exiting.

- [x] 4.0 Instrument runner and Pi subprocess execution
  - [x] 4.1 Log run start with run id, source, agent, model resolution summary, DB path, and workspace paths.
  - [x] 4.2 Log Pi subprocess command shape without secrets/full prompt.
  - [x] 4.3 Log run finish with status, exit code, signal, duration, output/error/trace character counts, and connector action count.
  - [x] 4.4 Log caught runner errors with stack/message to `runner.jsonl` and `errors.jsonl`.
  - [x] 4.5 Ensure non-zero Pi exits and stderr tails are visible in the log without duplicating large trace text.

- [x] 5.0 Preserve and improve scheduler/systemd visibility
  - [x] 5.1 Keep cron redirection to existing per-job files and document exact paths.
  - [x] 5.2 Add timestamped prologue/epilogue lines to generated cron wrapper scripts: command, cwd, instance home, start/end time, exit code.
  - [x] 5.3 Keep systemd stdout/stderr in journald and document file logs as complementary breadcrumbs.
  - [x] 5.4 Make sure crashes still show in `journalctl -u jumpygoat-hq-web` because logger echoes to console/stderr.

- [x] 6.0 Add operator docs for SSH debugging
  - [x] 6.1 Add a `Logs and troubleshooting` section to `docs/DEPLOY.md` with `tail -f`, `grep`, `jq`-optional/non-required commands, and `journalctl` examples.
  - [x] 6.2 Document first checks for: web down, automation failed, cron not firing, Pi auth missing, DB migration/setup issue, disk full, permission denied.
  - [x] 6.3 Document where run details live: SQLite `runs`, web run detail page, and file logs as operational breadcrumbs.
  - [x] 6.4 Add update/restart commands that capture recent logs before and after restart.

- [x] 7.0 Validate locally
  - [x] 7.1 Ran the web server briefly and confirmed `web.jsonl` records startup, request, and shutdown.
  - [x] 7.2 Ran `pnpm validate:backend` and confirmed runner logs record run start/finish details.
  - [x] 7.3 Covered generated cron wrapper behavior through the cron script validation in `pnpm validate:web`.
  - [x] 7.4 Confirmed logs are gitignored because they live under the instance/runtime home.

- [x] 8.0 Finish and document completion
  - [x] 8.1 Ran relevant validation: `pnpm validate:web` and `pnpm validate:backend`.
  - [x] 8.2 Updated `tasks/CHANGELOG.md` with the logging feature summary.
  - [x] 8.3 Move this task file to `tasks/done/` with a date prefix after implementation is complete.
