import { existsSync } from "node:fs";
import { readdir, readFile, rm } from "node:fs/promises";
import { agentPath, taskPath, tasksDir } from "../../../shared/paths.js";
import { boardExists, generateTaskId, loadTask, parseTaskMarkdown, TASK_PRIORITIES, TASK_STATUSES, transitionTaskStatus, writeTask, type AgentTask } from "../../../shared/tasks.js";
import type { ListOptions, RevisionPrecondition, TaskDto, TaskPriority, TaskStatus } from "../dto.js";
import { conflictError, notFoundError, validationError } from "../errors.js";
import { assertRevision, fileMeta } from "../files.js";
import { assertBoardName, assertTaskId, isSafeName } from "../names.js";
import { listBoards } from "./boards.js";

export type TaskListOptions = ListOptions & {
  board?: string;
  status?: TaskStatus;
};

export type TaskCreateInput = {
  id?: string;
  board: string;
  title: string;
  status: TaskStatus;
  assignee?: string;
  priority: TaskPriority;
  body: string;
};

export type TaskUpdateInput = RevisionPrecondition & Required<Pick<TaskCreateInput, "id">> & Omit<TaskCreateInput, "id">;

export type TaskStatusUpdateInput = RevisionPrecondition & {
  status: TaskStatus;
};

export interface TaskService {
  list(options?: TaskListOptions): Promise<TaskDto[]>;
  get(board: string, id: string, options?: ListOptions): Promise<TaskDto>;
  create(input: TaskCreateInput): Promise<TaskDto>;
  update(board: string, id: string, input: TaskUpdateInput): Promise<TaskDto>;
  updateStatus(board: string, id: string, input: TaskStatusUpdateInput): Promise<TaskDto>;
  delete(board: string, id: string): Promise<void>;
}

export async function listTasks(options: TaskListOptions = {}): Promise<TaskDto[]> {
  const boardIds = options.board ? [options.board] : (await listBoards()).map((board) => board.id);
  const tasks: TaskDto[] = [];
  for (const board of boardIds) {
    const dir = tasksDir(board);
    if (!existsSync(dir)) continue;
    const files = await readdir(dir, { withFileTypes: true });
    for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!file.isFile() || !file.name.endsWith(".md")) continue;
      const id = file.name.replace(/\.md$/, "");
      try {
        const task = await readTaskFile(board, id, options);
        if (!options.status || task.status === options.status) tasks.push(task);
      } catch (error) {
        tasks.push({
          id,
          title: id,
          board,
          status: "not-yet",
          assignee: "",
          priority: "normal",
          createdAt: "",
          updatedAt: "",
          attempts: 0,
          body: "",
          path: taskPath(board, id),
          warning: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  tasks.sort((a, b) => a.status.localeCompare(b.status) || b.priority.localeCompare(a.priority) || a.id.localeCompare(b.id));
  return tasks;
}

export async function getTask(board: string, id: string, options: ListOptions = {}): Promise<TaskDto> {
  assertBoardName(board);
  assertTaskId(id);
  if (!existsSync(taskPath(board, id))) throw notFoundError(`Task not found: ${board}/${id}`);
  return readTaskFile(board, id, options);
}

export async function createTask(input: TaskCreateInput): Promise<TaskDto> {
  const id = input.id || generateTaskId(input.title);
  const now = new Date().toISOString();
  const fullInput = { ...input, id };
  validateTaskInput(fullInput, "create");
  await writeTask(taskFromInput(fullInput, now, now, 0));
  return getTask(input.board, id, { includeRaw: true });
}

export async function updateTask(board: string, id: string, input: TaskUpdateInput): Promise<TaskDto> {
  assertBoardName(board);
  assertTaskId(id);
  if (board !== input.board || id !== input.id) throw conflictError("Renaming or moving tasks is not supported. Create a new task instead.");
  validateTaskInput(input, "update");
  await assertRevision(taskPath(board, id), input.ifMatch);
  const current = await loadTask(board, id);
  await writeTask(taskFromInput(input, current.created_at, new Date().toISOString(), current.attempts, current.claimed_at, current.run_id));
  return getTask(board, id, { includeRaw: true });
}

export async function updateTaskStatus(board: string, id: string, input: TaskStatusUpdateInput): Promise<TaskDto> {
  assertBoardName(board);
  assertTaskId(id);
  if (!TASK_STATUSES.includes(input.status)) throw validationError("Task status validation failed.", [{ field: "status", message: "Status is invalid." }]);
  await assertRevision(taskPath(board, id), input.ifMatch);
  await transitionTaskStatus(board, id, input.status);
  return getTask(board, id, { includeRaw: true });
}

export async function deleteTask(board: string, id: string): Promise<void> {
  assertBoardName(board);
  assertTaskId(id);
  if (!existsSync(taskPath(board, id))) throw notFoundError(`Task not found: ${board}/${id}`);
  await rm(taskPath(board, id), { force: false });
}

async function readTaskFile(board: string, id: string, options: ListOptions): Promise<TaskDto> {
  const file = taskPath(board, id);
  const raw = await readFile(file, "utf8");
  const task = parseTaskMarkdown(board, id, raw, file);
  return taskToDto(task, options.includeRaw ? raw : undefined, await fileMeta(file));
}

export function validateTaskInput(input: TaskCreateInput, mode: "create" | "update"): void {
  const fields = [];
  if (input.id && !isSafeName(input.id)) fields.push({ field: "id", message: "Task id must use lowercase letters, numbers, and hyphens only." });
  if (!isSafeName(input.board)) fields.push({ field: "board", message: "Board is required." });
  if (!input.title) fields.push({ field: "title", message: "Title is required." });
  if (!TASK_STATUSES.includes(input.status)) fields.push({ field: "status", message: "Status is invalid." });
  if (!TASK_PRIORITIES.includes(input.priority)) fields.push({ field: "priority", message: "Priority is invalid." });
  if ((input.status === "ready" || input.status === "working-on-it") && !input.assignee) fields.push({ field: "assignee", message: "Assignee is required before a task can be ready or working on it." });
  if (input.assignee && !existsSync(agentPath(input.assignee))) fields.push({ field: "assignee", message: `Assignee agent does not exist: ${input.assignee}` });
  if (isSafeName(input.board) && !boardExists(input.board)) fields.push({ field: "board", message: `Board does not exist: ${input.board}` });
  if (mode === "update" && !input.id) fields.push({ field: "id", message: "Task id is required." });
  if (isSafeName(input.board) && input.id && isSafeName(input.id)) {
    const exists = existsSync(taskPath(input.board, input.id));
    if (mode === "create" && exists) fields.push({ field: "id", message: `Task already exists: ${input.board}/${input.id}` });
    if (mode === "update" && !exists) fields.push({ field: "id", message: `Task does not exist: ${input.board}/${input.id}` });
  }
  if (fields.length) throw validationError("Task validation failed.", fields);
}

function taskFromInput(input: Required<Pick<TaskCreateInput, "id">> & TaskCreateInput, createdAt: string, updatedAt: string, attempts: number, claimedAt?: string, runId?: string): AgentTask {
  return {
    id: input.id,
    title: input.title,
    board: input.board,
    project: input.board,
    status: input.status,
    assignee: input.assignee || "",
    priority: input.priority,
    created_at: createdAt,
    updated_at: updatedAt,
    claimed_at: claimedAt,
    run_id: runId,
    attempts,
    body: input.body,
  };
}

function taskToDto(task: AgentTask, rawMarkdown: string | undefined, meta: { path?: string; updatedAt?: string; etag?: string }): TaskDto {
  return {
    id: task.id,
    title: task.title,
    board: task.board,
    status: task.status,
    assignee: task.assignee,
    priority: task.priority,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    claimedAt: task.claimed_at,
    runId: task.run_id,
    attempts: task.attempts,
    body: task.body,
    ...(rawMarkdown ? { rawMarkdown } : {}),
    ...meta,
  };
}
