import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectPath, taskPath } from "./paths.js";

export const SAFE_PROJECT_NAME = /^[a-z0-9][a-z0-9-]*$/;
export const SAFE_TASK_ID = /^[a-z0-9][a-z0-9-]*$/;
export const TASK_STATUSES = ["backlog", "ready", "doing", "review", "done", "blocked", "failed"];
export const TASK_PRIORITIES = ["low", "normal", "high", "urgent"];

export const TASK_TRANSITIONS = {
  backlog: ["ready", "blocked"],
  ready: ["backlog", "doing", "blocked"],
  doing: ["review", "done", "blocked", "failed"],
  review: ["ready", "done", "blocked"],
  done: ["review", "ready"],
  blocked: ["backlog", "ready"],
  failed: ["ready", "blocked"],
};

export function assertProjectName(name) {
  if (!SAFE_PROJECT_NAME.test(name)) throw new Error(`Invalid project name: ${name}. Use lowercase letters, numbers, and hyphens.`);
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

export async function loadProject(name) {
  assertProjectName(name);
  const file = projectPath(name);
  const raw = await readFile(file, "utf8");
  return parseProjectMarkdown(name, raw, file);
}

export function parseProjectMarkdown(name, raw, file = projectPath(name)) {
  assertProjectName(name);
  const parsed = parseFrontmatter(raw);
  const data = parsed.data || {};
  const projectName = String(data.name || name).trim();
  if (!projectName) throw new Error(`Project ${name} is missing name.`);
  const defaultAgent = data.default_agent == null ? undefined : String(data.default_agent).trim();
  return {
    id: name,
    name: projectName,
    description: data.description == null ? "" : String(data.description),
    default_agent: defaultAgent || undefined,
    path: file,
    body: parsed.content.trim(),
    raw,
  };
}

export async function loadTask(project, id) {
  assertProjectName(project);
  assertTaskId(id);
  const file = taskPath(project, id);
  const raw = await readFile(file, "utf8");
  return parseTaskMarkdown(project, id, raw, file);
}

export function parseTaskMarkdown(project, id, raw, file = taskPath(project, id)) {
  assertProjectName(project);
  assertTaskId(id);
  const parsed = parseFrontmatter(raw);
  const data = parsed.data || {};
  const taskId = String(data.id || id).trim();
  const taskProject = String(data.project || project).trim();
  assertTaskId(taskId);
  assertProjectName(taskProject);
  if (taskId !== id) throw new Error(`Task id mismatch in ${file}: expected ${id}, got ${taskId}.`);
  if (taskProject !== project) throw new Error(`Task project mismatch in ${file}: expected ${project}, got ${taskProject}.`);
  const status = String(data.status || "backlog").trim();
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
    project: taskProject,
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

export function projectMarkdown(values) {
  assertProjectName(values.id);
  const data = {
    name: values.name || values.id,
    description: values.description || "",
  };
  if (values.default_agent) data.default_agent = values.default_agent;
  return stringifyFrontmatter(data, values.body || "");
}

export function taskMarkdown(task) {
  assertProjectName(task.project);
  assertTaskId(task.id);
  assertTaskStatus(task.status);
  const data = {
    id: task.id,
    title: task.title,
    project: task.project,
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

export async function writeProject(project) {
  assertProjectName(project.id);
  await writeAtomic(projectPath(project.id), projectMarkdown(project));
}

export async function writeTask(task) {
  assertProjectName(task.project);
  assertTaskId(task.id);
  await writeAtomic(taskPath(task.project, task.id), taskMarkdown(task));
}

export async function updateTask(project, id, updater, options = {}) {
  const current = await loadTask(project, id);
  if (options.expectedStatus && current.status !== options.expectedStatus) {
    throw new Error(`Task ${project}/${id} is ${current.status}, expected ${options.expectedStatus}.`);
  }
  const next = updater({ ...current });
  next.updated_at = next.updated_at || new Date().toISOString();
  await writeTask(next);
  return next;
}

export async function transitionTaskStatus(project, id, status, options = {}) {
  assertTaskStatus(status);
  return await updateTask(project, id, (task) => {
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

export function projectExists(name) {
  assertProjectName(name);
  return existsSync(projectPath(name));
}

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
