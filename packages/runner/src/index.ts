#!/usr/bin/env node
import { loadDotEnv } from "./env.js";

loadDotEnv();
import { existsSync } from "node:fs";
import { ulid } from "ulid";
import { loadAgent } from "./agent.js";
import { loadAutomation } from "./automation.js";
import { dbPath, openDb, insertRun, finishRun } from "./db.js";
import { extractConnectorActionsFromTrace, processLegacyConnectorActions, resolveConnectorPlan } from "./connectors/index.js";
import { runPiAutomation } from "./pi.js";
import { agentPath } from "./paths.js";
import { createRunLog, errorText, outputText, pushTraceLine, traceText } from "./run-log.js";
import { loadSettings, resolveModelRequest } from "../../shared/settings.js";
import { extractUsageFromTraceText } from "./usage.js";

async function main(): Promise<number> {
  const name = process.argv[2];
  if (!name || name === "-h" || name === "--help") {
    console.error("Usage: agenthq-runner <automation-name>");
    return name ? 0 : 1;
  }

  const automation = await loadAutomation(name);
  const agentFile = agentPath(automation.agent);
  if (!existsSync(agentFile)) throw new Error(`Agent not found: ${agentFile}`);

  const agent = await loadAgent(automation.agent);
  const settings = loadSettings();
  const modelResolution = resolveModelRequest(automation.model ?? agent.model, settings);
  const model = modelResolution.resolvedModel;
  const db = openDb();
  const runId = process.env.RUN_ID || ulid();
  const startedAt = new Date().toISOString();
  const log = createRunLog();
  const connectorPlan = resolveConnectorPlan({ automation, agent, runId });

  pushTraceLine(log, {
    type: "agenthq_run_meta",
    run_id: runId,
    automation: automation.name,
    agent: automation.agent,
    agent_file: agentFile,
    agent_context_files: agent.contextFiles.map((file) => file.path),
    model: model ?? null,
    requested_model: modelResolution.requestedModel ?? null,
    resolved_model: modelResolution.resolvedModel ?? null,
    model_profile: modelResolution.profileKey ?? null,
    model_resolution_warning: modelResolution.warning ?? null,
    schedule: automation.schedule ?? null,
    started_at: startedAt,
  });

  insertRun(db, { runId, automation, agent, model: modelResolution.requestedModel, modelResolution, startedAt });

  console.log(`agenthq run ${runId}`);
  console.log(`db: ${dbPath()}`);

  try {
    const result = await runPiAutomation({ automation, agent, log, runId, model, connectorPlan });
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - Date.parse(startedAt);
    const status = result.exitCode === 0 ? "ok" : "error";
    const traceConnectorActions = extractConnectorActionsFromTrace(traceText(log));
    const handledIntents = new Set(traceConnectorActions.map((action) => action.intent));
    const legacyConnectorActions = await processLegacyConnectorActions({
      automation,
      agent,
      outputText: outputText(log),
      runSucceeded: status === "ok",
      alreadyHandledIntents: handledIntents,
    });
    const connectorActions = [...traceConnectorActions, ...legacyConnectorActions];
    if (connectorActions.length > 0) {
      pushTraceLine(log, { type: "agenthq_connector_actions", actions: connectorActions });
    }

    pushTraceLine(log, {
      type: "agenthq_summary",
      run_id: runId,
      automation: automation.name,
      agent: automation.agent,
      model: model ?? null,
      requested_model: modelResolution.requestedModel ?? null,
      resolved_model: modelResolution.resolvedModel ?? null,
      model_profile: modelResolution.profileKey ?? null,
      status,
      exit_code: result.exitCode,
      signal: result.signal,
      duration_ms: durationMs,
      finished_at: finishedAt,
    });

    const usage = extractUsageFromTraceText(traceText(log));

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
      usage,
    });
    db.close();
    return result.exitCode ?? 1;
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - Date.parse(startedAt);
    pushTraceLine(log, { type: "agenthq_error", message });
    log.errorLines.push(message);

    const connectorActions = extractConnectorActionsFromTrace(traceText(log));
    if (connectorActions.length > 0) {
      pushTraceLine(log, { type: "agenthq_connector_actions", actions: connectorActions });
    }

    const usage = extractUsageFromTraceText(traceText(log));

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
      connectorActionsJson: JSON.stringify(connectorActions),
      usage,
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
