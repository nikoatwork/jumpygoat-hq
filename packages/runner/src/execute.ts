import { existsSync } from "node:fs";
import { ulid } from "ulid";
import { loadAgent } from "./agent.js";
import { extractConnectorActionsFromTrace, processLegacyConnectorActions, resolveConnectorPlan } from "./connectors/index.js";
import { dbPath, finishRun, insertRun, openDb } from "./db.js";
import { invocationProject, invocationTaskId, type Invocation } from "./invocation.js";
import { agentPath } from "./paths.js";
import { runPiInvocation } from "./pi.js";
import { createRunLog, errorText, outputText, pushTraceLine, traceText } from "./run-log.js";
import { loadSettings, resolveModelRequest } from "../../shared/settings.js";
import { extractUsageFromTraceText } from "./usage.js";

export type InvocationExecutionResult = {
  runId: string;
  status: "ok" | "error";
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
};

export async function executeInvocation(invocation: Invocation, options: { runId?: string; label?: string } = {}): Promise<InvocationExecutionResult> {
  const agentFile = agentPath(invocation.agent);
  if (!existsSync(agentFile)) throw new Error(`Agent not found: ${agentFile}`);

  const agent = await loadAgent(invocation.agent);
  const settings = loadSettings();
  const modelResolution = resolveModelRequest(invocation.model ?? agent.model, settings);
  const model = modelResolution.resolvedModel;
  const db = openDb();
  const runId = options.runId || process.env.RUN_ID || ulid();
  const startedAt = new Date().toISOString();
  const log = createRunLog();
  const connectorPlan = resolveConnectorPlan({ invocation, agent, runId });
  const project = invocationProject(invocation);
  const taskId = invocationTaskId(invocation);

  pushTraceLine(log, {
    type: "agenthq_run_meta",
    run_id: runId,
    source_type: invocation.source.type,
    source_id: invocation.source.id,
    automation: invocation.source.type === "automation" ? invocation.source.id : undefined,
    agent: invocation.agent,
    agent_file: agentFile,
    agent_context_files: agent.contextFiles.map((file) => file.path),
    model: model ?? null,
    requested_model: modelResolution.requestedModel ?? null,
    resolved_model: modelResolution.resolvedModel ?? null,
    model_profile: modelResolution.profileKey ?? null,
    model_resolution_warning: modelResolution.warning ?? null,
    schedule: invocation.schedule ?? null,
    project: project ?? null,
    task_id: taskId ?? null,
    started_at: startedAt,
  });

  insertRun(db, { runId, invocation, agent, model: modelResolution.requestedModel, modelResolution, startedAt });

  console.log(`${options.label || "agenthq run"} ${runId}`);
  if (invocation.source.type === "task") console.log(`task: ${invocation.source.id}`);
  console.log(`db: ${dbPath()}`);

  try {
    const result = await runPiInvocation({ invocation, agent, log, runId, model, connectorPlan });
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - Date.parse(startedAt);
    const status = result.exitCode === 0 ? "ok" : "error";
    const traceConnectorActions = extractConnectorActionsFromTrace(traceText(log));
    const handledIntents = new Set(traceConnectorActions.map((action) => action.intent));
    const legacyConnectorActions = await processLegacyConnectorActions({
      invocation,
      agent,
      outputText: outputText(log),
      runSucceeded: status === "ok",
      alreadyHandledIntents: handledIntents,
    });
    const connectorActions = [...traceConnectorActions, ...legacyConnectorActions];
    if (connectorActions.length > 0) pushTraceLine(log, { type: "agenthq_connector_actions", actions: connectorActions });

    pushTraceLine(log, {
      type: "agenthq_summary",
      run_id: runId,
      source_type: invocation.source.type,
      source_id: invocation.source.id,
      automation: invocation.source.type === "automation" ? invocation.source.id : undefined,
      agent: invocation.agent,
      model: model ?? null,
      requested_model: modelResolution.requestedModel ?? null,
      resolved_model: modelResolution.resolvedModel ?? null,
      model_profile: modelResolution.profileKey ?? null,
      project: project ?? null,
      task_id: taskId ?? null,
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
      usage: extractUsageFromTraceText(traceText(log)),
    });
    return { runId, status, exitCode: result.exitCode, signal: result.signal, startedAt, finishedAt, durationMs };
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - Date.parse(startedAt);
    pushTraceLine(log, { type: "agenthq_error", message });
    log.errorLines.push(message);

    const connectorActions = extractConnectorActionsFromTrace(traceText(log));
    if (connectorActions.length > 0) pushTraceLine(log, { type: "agenthq_connector_actions", actions: connectorActions });

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
      usage: extractUsageFromTraceText(traceText(log)),
    });
    throw error;
  } finally {
    db.close();
  }
}
