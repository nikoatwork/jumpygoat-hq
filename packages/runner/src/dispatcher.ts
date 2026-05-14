import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { ulid } from "ulid";
import type { Automation } from "./automation.js";
import { loadAgent } from "./agent.js";
import { extractConnectorActionsFromTrace, processLegacyConnectorActions, resolveConnectorPlan } from "./connectors/index.js";
import { dbPath, finishRun, insertRun, openDb } from "./db.js";
import { agentPath, projectsDir, taskPath, tasksDir } from "./paths.js";
import { runPiAutomation } from "./pi.js";
import { createRunLog, errorText, outputText, pushTraceLine, traceText } from "./run-log.js";
import { loadProject, loadTask, updateTask, type AgentTask, type Project } from "./task.js";

export type DispatchResult = {
  attempted: number;
  dispatched: number;
  skipped: number;
  messages: string[];
};

const PRIORITY_RANK: Record<string, number> = { urgent: 4, high: 3, normal: 2, low: 1 };

export async function dispatchTasks(options: { limit?: number } = {}): Promise<DispatchResult> {
  const limit = Math.max(1, options.limit || Number(process.env.AGENTHQ_TASK_DISPATCH_LIMIT || 1) || 1);
  const messages: string[] = [];
  const ready = await listDispatchableTasks();
  let dispatched = 0;
  let skipped = 0;

  if (ready.length === 0) messages.push("No ready assigned tasks found.");

  for (const item of ready) {
    if (dispatched >= limit) break;
    const agentFile = agentPath(item.task.assignee);
    if (!item.task.assignee || !existsSync(agentFile)) {
      skipped += 1;
      messages.push(`skip ${item.task.project}/${item.task.id}: assignee agent not found (${item.task.assignee || "empty"})`);
      continue;
    }
    try {
      const runId = ulid();
      const exitCode = await dispatchOne(item.project, item.task, runId);
      dispatched += 1;
      messages.push(`dispatched ${item.task.project}/${item.task.id} run=${runId} exit=${exitCode}`);
    } catch (error) {
      skipped += 1;
      messages.push(`error ${item.task.project}/${item.task.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { attempted: ready.length, dispatched, skipped, messages };
}

async function listDispatchableTasks(): Promise<Array<{ project: Project; task: AgentTask }>> {
  if (!existsSync(projectsDir())) return [];
  const projects = await readdir(projectsDir(), { withFileTypes: true });
  const ready: Array<{ project: Project; task: AgentTask }> = [];
  for (const projectEntry of projects.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!projectEntry.isDirectory()) continue;
    const projectName = projectEntry.name;
    const projectTaskDir = tasksDir(projectName);
    if (!existsSync(projectTaskDir)) continue;
    let project: Project;
    try {
      project = await loadProject(projectName);
    } catch (error) {
      // Skip malformed projects instead of blocking unrelated task dispatch.
      continue;
    }
    const files = await readdir(projectTaskDir, { withFileTypes: true });
    for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!file.isFile() || !file.name.endsWith(".md")) continue;
      const id = file.name.replace(/\.md$/, "");
      try {
        const task = await loadTask(projectName, id);
        if (task.status === "ready" && task.assignee) ready.push({ project, task });
      } catch {
        // Malformed task files are ignored by the dispatcher; the web UI/docs expose the parser errors.
      }
    }
  }

  ready.sort((a, b) => {
    const priority = (PRIORITY_RANK[b.task.priority] || 0) - (PRIORITY_RANK[a.task.priority] || 0);
    if (priority) return priority;
    return String(a.task.created_at || a.task.id).localeCompare(String(b.task.created_at || b.task.id));
  });
  return ready;
}

async function dispatchOne(project: Project, task: AgentTask, runId: string): Promise<number | null> {
  const agent = await loadAgent(task.assignee);
  const automation = taskAutomation(project, task);
  const model = agent.model;
  const db = openDb();
  const startedAt = new Date().toISOString();
  const log = createRunLog();
  const connectorPlan = resolveConnectorPlan({ automation, agent, runId });
  let claimed = false;

  try {
    await updateTask(task.project, task.id, (current) => ({
      ...current,
      status: "doing",
      claimed_at: startedAt,
      run_id: runId,
      attempts: current.attempts + 1,
      updated_at: startedAt,
    }), { expectedStatus: "ready" });
    claimed = true;

    pushTraceLine(log, {
      type: "agenthq_run_meta",
      run_id: runId,
      automation: automation.name,
      agent: automation.agent,
      agent_file: agentPath(automation.agent),
      agent_context_files: agent.contextFiles.map((file) => file.path),
      model: model ?? null,
      schedule: "task-dispatch",
      project: task.project,
      task_id: task.id,
      started_at: startedAt,
    });

    insertRun(db, { runId, automation, agent, model, startedAt, project: task.project, taskId: task.id });
    console.log(`agenthq task run ${runId}`);
    console.log(`task: ${task.project}/${task.id}`);
    console.log(`db: ${dbPath()}`);

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
    if (connectorActions.length > 0) pushTraceLine(log, { type: "agenthq_connector_actions", actions: connectorActions });

    pushTraceLine(log, {
      type: "agenthq_summary",
      run_id: runId,
      automation: automation.name,
      agent: automation.agent,
      model: model ?? null,
      project: task.project,
      task_id: task.id,
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

    await updateTask(task.project, task.id, (current) => ({
      ...current,
      status: status === "ok" ? "review" : "failed",
      run_id: runId,
      updated_at: finishedAt,
      body: status === "ok" ? current.body : appendDispatchNote(current.body, `Run ${runId} failed with exit ${result.exitCode ?? "unknown"}.`),
    }));
    return result.exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    const finishedAt = new Date().toISOString();
    pushTraceLine(log, { type: "agenthq_error", message });
    log.errorLines.push(message);

    try {
      finishRun(db, {
        runId,
        status: "error",
        finishedAt,
        durationMs: Date.now() - Date.parse(startedAt),
        exitCode: 1,
        signal: null,
        outputText: outputText(log),
        traceText: traceText(log),
        errorText: errorText(log),
        connectorActionsJson: JSON.stringify(extractConnectorActionsFromTrace(traceText(log))),
      });
    } catch {
      // If the row was never inserted, preserving the task failure note is enough.
    }

    if (claimed && existsSync(taskPath(task.project, task.id))) {
      await updateTask(task.project, task.id, (current) => ({
        ...current,
        status: "failed",
        run_id: runId,
        updated_at: finishedAt,
        body: appendDispatchNote(current.body, `Run ${runId} crashed: ${message}`),
      }));
    }
    throw error;
  } finally {
    db.close();
  }
}

function taskAutomation(project: Project, task: AgentTask): Automation {
  return {
    name: `task-${task.project}-${task.id}`,
    agent: task.assignee,
    schedule: "manual",
    prompt: taskPrompt(project, task),
  } as Automation;
}

function taskPrompt(project: Project, task: AgentTask): string {
  return `You are executing an AgentHQ assigned task.\n\nProject: ${project.name} (${project.id})\nTask: ${task.title} (${task.project}/${task.id})\nPriority: ${task.priority}\nStatus at dispatch: ${task.status}\n\n# Project context\n${project.description || "No description."}\n\n${project.body || "No project body."}\n\n# Task body\n${task.body || "No task body."}\n\n# Completion instructions\n- Do the requested work using the repository/workspace available to Pi.\n- Keep changes focused on this task.\n- When finished, summarize what changed and any verification performed.\n- Do not edit the task markdown status yourself; the AgentHQ dispatcher records run status after Pi exits.\n`;
}

function appendDispatchNote(body: string, note: string): string {
  const timestamp = new Date().toISOString();
  return `${body.trimEnd()}\n\n## Dispatch notes\n\n- ${timestamp}: ${note}\n`;
}
