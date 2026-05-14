import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { ulid } from "ulid";
import { executeInvocation } from "./execute.js";
import { invocationFromTask } from "./invocation.js";
import { agentPath, boardsDir, taskPath, tasksDir } from "./paths.js";
import { loadBoard, loadTask, updateTask, type AgentTask, type Board } from "./task.js";

export type DispatchResult = {
  attempted: number;
  dispatched: number;
  skipped: number;
  messages: string[];
};

const PRIORITY_RANK: Record<string, number> = { urgent: 4, high: 3, normal: 2, low: 1 };

export async function dispatchTasks(options: { limit?: number } = {}): Promise<DispatchResult> {
  const limit = Math.max(1, options.limit || Number(process.env.JUMPYGOATHQ_TASK_DISPATCH_LIMIT || 1) || 1);
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
      messages.push(`skip ${item.task.board}/${item.task.id}: assignee agent not found (${item.task.assignee || "empty"})`);
      continue;
    }
    try {
      const runId = ulid();
      const exitCode = await dispatchOne(item.board, item.task, runId);
      dispatched += 1;
      messages.push(`dispatched ${item.task.board}/${item.task.id} run=${runId} exit=${exitCode}`);
    } catch (error) {
      skipped += 1;
      messages.push(`error ${item.task.board}/${item.task.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { attempted: ready.length, dispatched, skipped, messages };
}

async function listDispatchableTasks(): Promise<Array<{ board: Board; task: AgentTask }>> {
  if (!existsSync(boardsDir())) return [];
  const boards = await readdir(boardsDir(), { withFileTypes: true });
  const ready: Array<{ board: Board; task: AgentTask }> = [];
  for (const boardEntry of boards.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!boardEntry.isDirectory()) continue;
    const boardName = boardEntry.name;
    const boardTaskDir = tasksDir(boardName);
    if (!existsSync(boardTaskDir)) continue;
    let board: Board;
    try {
      board = await loadBoard(boardName);
    } catch (error) {
      // Skip malformed boards instead of blocking unrelated task dispatch.
      continue;
    }
    const files = await readdir(boardTaskDir, { withFileTypes: true });
    for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!file.isFile() || !file.name.endsWith(".md")) continue;
      const id = file.name.replace(/\.md$/, "");
      try {
        const task = await loadTask(boardName, id);
        if (task.status === "ready" && task.assignee) ready.push({ board, task });
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

async function dispatchOne(board: Board, task: AgentTask, runId: string): Promise<number | null> {
  const startedAt = new Date().toISOString();
  let claimed = false;

  try {
    await updateTask(task.board, task.id, (current) => ({
      ...current,
      status: "working-on-it",
      claimed_at: startedAt,
      run_id: runId,
      attempts: current.attempts + 1,
      updated_at: startedAt,
    }), { expectedStatus: "ready" });
    claimed = true;

    const result = await executeInvocation(invocationFromTask(board, task), { runId, label: "agenthq task run" });
    await updateTask(task.board, task.id, (current) => ({
      ...current,
      status: result.status === "ok" ? "done" : "not-yet",
      run_id: runId,
      updated_at: result.finishedAt,
      body: result.status === "ok" ? current.body : appendDispatchNote(current.body, `Run ${runId} failed with exit ${result.exitCode ?? "unknown"}.`),
    }));
    return result.exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    const finishedAt = new Date().toISOString();
    if (claimed && existsSync(taskPath(task.board, task.id))) {
      await updateTask(task.board, task.id, (current) => ({
        ...current,
        status: "not-yet",
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
