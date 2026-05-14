import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { boardPath, taskPath } from "./paths.js";

export const SAFE_BOARD_NAME = /^[a-z0-9][a-z0-9-]*$/;
export const SAFE_TASK_ID = /^[a-z0-9][a-z0-9-]*$/;
export const TASK_STATUSES = ["not-yet", "ready", "working-on-it", "done"];
export const TASK_STATUS_LABELS = {
  "not-yet": "not yet",
  ready: "ready",
  "working-on-it": "working on it",
  done: "done",
};
export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"];

export const TASK_TRANSITIONS = {
  "not-yet": ["ready", "working-on-it", "done"],
  ready: ["not-yet", "working-on-it", "done"],
  "working-on-it": ["not-yet", "ready", "done"],
  done: ["not-yet", "ready", "working-on-it"],
};

const LEGACY_STATUS_MAP = {
  backlog: "not-yet",
  blocked: "not-yet",
  failed: "not-yet",
  doing: "working-on-it",
  review: "done",
};

export function taskStatusLabel(status) {
  return TASK_STATUS_LABELS[status] || status;
}

export function normalizeTaskStatus(status) {
  const value = String(status || "not-yet").trim();
  return LEGACY_STATUS_MAP[value] || value;
}

export function assertBoardName(name) {
  if (!SAFE_BOARD_NAME.test(name)) throw new Error(`Invalid board name: ${name}. Use lowercase letters, numbers, and hyphens.`);
}

export function assertTaskId(id) {
  if (!SAFE_TASK_ID.test(id)) throw new Error(`Invalid task id: ${id}. Use lowercase letters, numbers, and hyphens.`);
}

export function assertTaskStatus(status) {
  if (!TASK_STATUSES.includes(status)) throw new Error(`Invalid task status: ${status}`);
}

export function canTransitionTask(from, to) {
  if (from === to) return true;
  return Boolean(TASK_TRANSITIONS[from]?.includes(to));
}

export function assertTaskTransition(from, to) {
  assertTaskStatus(from);
  assertTaskStatus(to);
  if (!canTransitionTask(from, to)) throw new Error(`Task cannot transition from ${from} to ${to}.`);
}

export function generateTaskId(title, now = new Date()) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "").slice(0, 14);
  const slug = String(title || "task")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "task";
  return `${stamp}-${slug}`;
}

export async function loadBoard(name) {
  assertBoardName(name);
  const file = boardPath(name);
  const raw = await readFile(file, "utf8");
  return parseBoardMarkdown(name, raw, file);
}

export function parseBoardMarkdown(name, raw, file = boardPath(name)) {
  assertBoardName(name);
  const parsed = parseFrontmatter(raw);
  const data = parsed.data || {};
  const boardName = String(data.name || name).trim();
  if (!boardName) throw new Error(`Board ${name} is missing name.`);
  const defaultAgent = data.default_agent == null ? undefined : String(data.default_agent).trim();
  return {
    id: name,
    name: boardName,
    description: data.description == null ? "" : String(data.description),
    default_agent: defaultAgent || undefined,
    path: file,
    body: parsed.content.trim(),
    raw,
  };
}

export async function loadTask(board, id) {
  assertBoardName(board);
  assertTaskId(id);
  const file = taskPath(board, id);
  const raw = await readFile(file, "utf8");
  return parseTaskMarkdown(board, id, raw, file);
}

export function parseTaskMarkdown(board, id, raw, file = taskPath(board, id)) {
  assertBoardName(board);
  assertTaskId(id);
  const parsed = parseFrontmatter(raw);
  const data = parsed.data || {};
  const taskId = String(data.id || id).trim();
  const taskBoard = String(data.board || data.project || board).trim();
  assertTaskId(taskId);
  assertBoardName(taskBoard);
  if (taskId !== id) throw new Error(`Task id mismatch in ${file}: expected ${id}, got ${taskId}.`);
  if (taskBoard !== board) throw new Error(`Task board mismatch in ${file}: expected ${board}, got ${taskBoard}.`);
  const status = normalizeTaskStatus(data.status);
  assertTaskStatus(status);
  const priority = String(data.priority || "normal").trim();
  if (!TASK_PRIORITIES.includes(priority)) throw new Error(`Invalid priority for task ${id}: ${priority}`);
  const attempts = Number(data.attempts ?? 0);
  if (!Number.isInteger(attempts) || attempts < 0) throw new Error(`Invalid attempts for task ${id}: ${data.attempts}`);
  const title = String(data.title || id).trim();
  if (!title) throw new Error(`Task ${id} is missing title.`);
  return {
    id: taskId,
    title,
    board: taskBoard,
    project: taskBoard,
    status,
    assignee: data.assignee == null ? "" : String(data.assignee).trim(),
    priority,
    created_at: data.created_at == null ? "" : String(data.created_at),
    updated_at: data.updated_at == null ? "" : String(data.updated_at),
    claimed_at: data.claimed_at == null ? undefined : String(data.claimed_at),
    run_id: data.run_id == null ? undefined : String(data.run_id),
    attempts,
    path: file,
    body: parsed.content.trim(),
    raw,
  };
}

export function boardMarkdown(values) {
  assertBoardName(values.id);
  const data = {
    name: values.name || values.id,
    description: values.description || "",
  };
  if (values.default_agent) data.default_agent = values.default_agent;
  return stringifyFrontmatter(data, values.body || "");
}

export function taskMarkdown(task) {
  const board = task.board || task.project;
  assertBoardName(board);
  assertTaskId(task.id);
  assertTaskStatus(task.status);
  const data = {
    id: task.id,
    title: task.title,
    board,
    status: task.status,
    assignee: task.assignee || "",
    priority: task.priority || "normal",
    created_at: task.created_at || new Date().toISOString(),
    updated_at: task.updated_at || new Date().toISOString(),
    attempts: Number.isInteger(task.attempts) ? task.attempts : 0,
  };
  if (task.claimed_at) data.claimed_at = task.claimed_at;
  if (task.run_id) data.run_id = task.run_id;
  return stringifyFrontmatter(data, task.body || "");
}

export async function writeBoard(board) {
  assertBoardName(board.id);
  await writeAtomic(boardPath(board.id), boardMarkdown(board));
}

export async function writeTask(task) {
  const board = task.board || task.project;
  assertBoardName(board);
  assertTaskId(task.id);
  await writeAtomic(taskPath(board, task.id), taskMarkdown(task));
}

export async function updateTask(board, id, updater, options = {}) {
  const current = await loadTask(board, id);
  if (options.expectedStatus && current.status !== options.expectedStatus) {
    throw new Error(`Task ${board}/${id} is ${current.status}, expected ${options.expectedStatus}.`);
  }
  const next = updater({ ...current });
  next.board = next.board || next.project || board;
  next.project = next.board;
  next.updated_at = next.updated_at || new Date().toISOString();
  await writeTask(next);
  return next;
}

export async function transitionTaskStatus(board, id, status, options = {}) {
  assertTaskStatus(status);
  return await updateTask(board, id, (task) => {
    if (!options.force) assertTaskTransition(task.status, status);
    task.status = status;
    task.updated_at = new Date().toISOString();
    return task;
  }, options);
}

export async function writeAtomic(file, content) {
  const dir = path.dirname(file);
  await mkdir(dir, { recursive: true });
  const temp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  await writeFile(temp, content, "utf8");
  await rename(temp, file);
}

export function boardExists(name) {
  assertBoardName(name);
  return existsSync(boardPath(name));
}

// Legacy aliases kept only so older internal imports fail softly during the pre-release rename.
export const SAFE_PROJECT_NAME = SAFE_BOARD_NAME;
export const assertProjectName = assertBoardName;
export const loadProject = loadBoard;
export const parseProjectMarkdown = parseBoardMarkdown;
export const projectMarkdown = boardMarkdown;
export const writeProject = writeBoard;
export const projectExists = boardExists;

function parseFrontmatter(raw) {
  if (!raw.startsWith("---\n")) return { data: {}, content: raw };
  const end = raw.indexOf("\n---", 4);
  if (end === -1) throw new Error("Missing closing frontmatter fence.");
  const yaml = raw.slice(4, end);
  const contentStart = raw.indexOf("\n", end + 4);
  const content = contentStart === -1 ? "" : raw.slice(contentStart + 1);
  const data = {};
  for (const line of yaml.split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const index = line.indexOf(":");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const rawValue = line.slice(index + 1).trim();
    data[key] = parseYamlValue(rawValue);
  }
  return { data, content };
}

function parseYamlValue(value) {
  if (value === "" || value === "null" || value === "~") return undefined;
  if (/^-?\d+$/.test(value)) return Number(value);
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    try {
      return JSON.parse(value.startsWith("'") ? JSON.stringify(value.slice(1, -1)) : value);
    } catch {
      return value.slice(1, -1);
    }
  }
  return value.replace(/\s+#.*$/, "");
}

function stringifyFrontmatter(data, body) {
  const lines = ["---"];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "number") lines.push(`${key}: ${value}`);
    else lines.push(`${key}: ${JSON.stringify(String(value))}`);
  }
  lines.push("---", "", (body || "").trimEnd(), "");
  return lines.join("\n");
}
