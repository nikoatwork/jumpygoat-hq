#!/usr/bin/env node
import { loadDotEnv } from "./env.js";

loadDotEnv();
import { existsSync } from "node:fs";
import { ulid } from "ulid";
import { loadAutomation } from "./automation.js";
import { openDb, insertRun, finishRun } from "./db.js";
import { processConnectorActions } from "./connectors.js";
import { runPiAutomation } from "./pi.js";
import { skillPath } from "./paths.js";
import { createRunLog, errorText, outputText, pushTraceLine, traceText } from "./run-log.js";
import { loadSkillMeta } from "./skill.js";

async function main(): Promise<number> {
  const name = process.argv[2];
  if (!name || name === "-h" || name === "--help") {
    console.error("Usage: agenthq-runner <automation-name>");
    return name ? 0 : 1;
  }

  const automation = await loadAutomation(name);
  const skillFile = skillPath(automation.skill);
  if (!existsSync(skillFile)) throw new Error(`Skill not found: ${skillFile}`);

  const skillMeta = await loadSkillMeta(automation.skill);
  const db = openDb();
  const runId = process.env.RUN_ID || ulid();
  const startedAt = new Date().toISOString();
  const log = createRunLog();

  pushTraceLine(log, {
    type: "agenthq_run_meta",
    run_id: runId,
    automation: automation.name,
    skill: automation.skill,
    skill_file: skillFile,
    model: automation.model ?? null,
    schedule: automation.schedule ?? null,
    started_at: startedAt,
  });

  insertRun(db, { runId, automation, startedAt });

  console.log(`agenthq run ${runId}`);
  console.log(`db: ${process.env.AGENTHQ_DB_PATH || "data/agenthq.sqlite"}`);

  try {
    const result = await runPiAutomation({ automation, log });
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - Date.parse(startedAt);
    const status = result.exitCode === 0 ? "ok" : "error";
    const connectorActions = await processConnectorActions({
      automation,
      skill: skillMeta,
      outputText: outputText(log),
      runSucceeded: status === "ok",
    });
    if (connectorActions.length > 0) {
      pushTraceLine(log, { type: "agenthq_connector_actions", actions: connectorActions });
    }

    pushTraceLine(log, {
      type: "agenthq_summary",
      run_id: runId,
      automation: automation.name,
      skill: automation.skill,
      model: automation.model ?? null,
      status,
      exit_code: result.exitCode,
      signal: result.signal,
      duration_ms: durationMs,
      finished_at: finishedAt,
    });

    finishRun(db, {
      runId,
      status,
      finishedAt,
      durationMs,
      exitCode: result.exitCode,
      signal: result.signal,
      outputText: outputText(log),
      traceText: traceText(log),
      errorText: errorText(log),
      connectorActionsJson: JSON.stringify(connectorActions),
    });
    db.close();
    return result.exitCode ?? 1;
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - Date.parse(startedAt);
    pushTraceLine(log, { type: "agenthq_error", message });
    log.errorLines.push(message);

    finishRun(db, {
      runId,
      status: "error",
      finishedAt,
      durationMs,
      exitCode: 1,
      signal: null,
      outputText: outputText(log),
      traceText: traceText(log),
      errorText: errorText(log),
    });
    db.close();
    throw error;
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
