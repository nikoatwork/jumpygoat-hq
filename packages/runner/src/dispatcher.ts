import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { ulid } from "ulid";
import { executeInvocation } from "./execute.js";
import { invocationFromTask } from "./invocation.js";
import { agentPath, projectsDir, taskPath, tasksDir } from "./paths.js";
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
  const startedAt = new Date().toISOString();
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

    const result = await executeInvocation(invocationFromTask(project, task), { runId, label: "agenthq task run" });
    await updateTask(task.project, task.id, (current) => ({
      ...current,
      status: result.status === "ok" ? "review" : "failed",
      run_id: runId,
      updated_at: result.finishedAt,
      body: result.status === "ok" ? current.body : appendDispatchNote(current.body, `Run ${runId} failed with exit ${result.exitCode ?? "unknown"}.`),
    }));
    return result.exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    const finishedAt = new Date().toISOString();
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
  }
}

function appendDispatchNote(body: string, note: string): string {
  const timestamp = new Date().toISOString();
  return `${body.trimEnd()}\n\n## Dispatch notes\n\n- ${timestamp}: ${note}\n`;
}
