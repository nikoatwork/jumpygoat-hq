import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { agentsDir, automationsDir, repoRoot, settingsPath } from "./paths.js";
import { generateTaskId, loadProject, loadTask, projectExists, TASK_PRIORITIES, TASK_STATUSES, transitionTaskStatus, writeProject, writeTask, type AgentTask, type Project, type TaskStatus } from "../../shared/tasks.js";
import { listAgents, listAutomations, listProjects } from "./readers.js";
import { defaultSettingsText, parseSettingsText } from "../../shared/settings.js";

export type AutomationFormValues = {
  name: string;
  agent: string;
  schedule: string;
  model: string;
  prompt: string;
};

export type AgentFormValues = {
  name: string;
  content: string;
};

export type ProjectFormValues = {
  id: string;
  name: string;
  description: string;
  default_agent: string;
  body: string;
};

export type TaskFormValues = {
  id: string;
  project: string;
  title: string;
  status: string;
  assignee: string;
  priority: string;
  body: string;
};

export type SettingsFormValues = {
  content: string;
};

export type ValidationResult<T> = { ok: true; values: T } | { ok: false; values: T; errors: string[] };

const SAFE_NAME = /^[a-z0-9][a-z0-9-]*$/;

export function assertAutomationName(name: string): void {
  if (!SAFE_NAME.test(name)) throw new Error(`Invalid automation name: ${name}`);
}

export function assertAgentName(name: string): void {
  if (!SAFE_NAME.test(name)) throw new Error(`Invalid agent name: ${name}`);
}

export function assertProjectName(name: string): void {
  if (!SAFE_NAME.test(name)) throw new Error(`Invalid project name: ${name}`);
}

export function assertTaskId(id: string): void {
  if (!SAFE_NAME.test(id)) throw new Error(`Invalid task id: ${id}`);
}

export function automationPath(name: string): string {
  assertAutomationName(name);
  return path.join(automationsDir(), `${name}.md`);
}

export function localAgentPath(name: string): string {
  assertAgentName(name);
  return path.join(agentsDir(), name, "AGENT.md");
}

export function parseAutomationForm(form: URLSearchParams, fallbackName = ""): AutomationFormValues {
  return {
    name: String(form.get("name") || fallbackName).trim(),
    agent: String(form.get("agent") || "").trim(),
    schedule: parseScheduleForm(form),
    model: String(form.get("model") || "").trim(),
    prompt: String(form.get("prompt") || "").trim(),
  };
}

export function parseAgentForm(form: URLSearchParams, fallbackName = ""): AgentFormValues {
  return {
    name: String(form.get("name") || fallbackName).trim(),
    content: String(form.get("content") || ""),
  };
}

export function parseProjectForm(form: URLSearchParams, fallbackId = ""): ProjectFormValues {
  const id = String(form.get("id") || fallbackId).trim();
  return {
    id,
    name: String(form.get("name") || id).trim(),
    description: String(form.get("description") || "").trim(),
    default_agent: String(form.get("default_agent") || "").trim(),
    body: String(form.get("body") || ""),
  };
}

export function parseTaskForm(form: URLSearchParams, fallbackProject = "", fallbackId = ""): TaskFormValues {
  return {
    id: String(form.get("id") || fallbackId).trim(),
    project: String(form.get("project") || fallbackProject).trim(),
    title: String(form.get("title") || "").trim(),
    status: String(form.get("status") || "backlog").trim(),
    assignee: String(form.get("assignee") || "").trim(),
    priority: String(form.get("priority") || "normal").trim(),
    body: String(form.get("body") || ""),
  };
}

export function parseSettingsForm(form: URLSearchParams): SettingsFormValues {
  return { content: String(form.get("content") || "") };
}

export async function validateAutomation(values: AutomationFormValues, mode: "create" | "update"): Promise<ValidationResult<AutomationFormValues>> {
  const errors: string[] = [];
  if (!SAFE_NAME.test(values.name)) errors.push("Name must use lowercase letters, numbers, and hyphens only.");
  if (!values.agent) errors.push("Agent is required.");
  if (!values.prompt) errors.push("Prompt is required.");
  if (!isValidSchedule(values.schedule)) errors.push("Schedule must be 'manual' or a valid 5-field cron expression.");
  if (values.model.length > 200) errors.push("Model must be 200 characters or fewer.");

  const agents = await listAgents();
  if (values.agent && !agents.some((agent) => agent.name === values.agent)) errors.push(`Agent does not exist: ${values.agent}`);

  if (SAFE_NAME.test(values.name)) {
    const exists = existsSync(automationPath(values.name));
    if (mode === "create" && exists) errors.push(`Automation already exists: ${values.name}`);
    if (mode === "update" && !exists) errors.push(`Automation does not exist: ${values.name}`);
  }

  return errors.length ? { ok: false, values, errors } : { ok: true, values };
}

export async function validateProject(values: ProjectFormValues, mode: "create" | "update"): Promise<ValidationResult<ProjectFormValues>> {
  const errors: string[] = [];
  if (!SAFE_NAME.test(values.id)) errors.push("Project id must use lowercase letters, numbers, and hyphens only.");
  if (!values.name) errors.push("Project name is required.");
  if (values.default_agent) {
    const agents = await listAgents();
    if (!agents.some((agent) => agent.name === values.default_agent)) errors.push(`Default agent does not exist: ${values.default_agent}`);
  }
  if (SAFE_NAME.test(values.id)) {
    const exists = projectExists(values.id);
    if (mode === "create" && exists) errors.push(`Project already exists: ${values.id}`);
    if (mode === "update" && !exists) errors.push(`Project does not exist: ${values.id}`);
  }
  return errors.length ? { ok: false, values, errors } : { ok: true, values };
}

export async function validateTask(values: TaskFormValues, mode: "create" | "update"): Promise<ValidationResult<TaskFormValues>> {
  const errors: string[] = [];
  if (values.id && !SAFE_NAME.test(values.id)) errors.push("Task id must use lowercase letters, numbers, and hyphens only.");
  if (!SAFE_NAME.test(values.project)) errors.push("Project is required.");
  if (!values.title) errors.push("Title is required.");
  if (!TASK_STATUSES.includes(values.status as TaskStatus)) errors.push("Status is invalid.");
  if (!TASK_PRIORITIES.includes(values.priority as never)) errors.push("Priority is invalid.");
  if ((values.status === "ready" || values.status === "doing") && !values.assignee) errors.push("Assignee is required before a task can be ready or doing.");
  if (values.assignee) {
    const agents = await listAgents();
    if (!agents.some((agent) => agent.name === values.assignee)) errors.push(`Assignee agent does not exist: ${values.assignee}`);
  }
  if (SAFE_NAME.test(values.project)) {
    const projects = await listProjects();
    if (!projects.some((project) => project.id === values.project)) errors.push(`Project does not exist: ${values.project}`);
  }
  if (mode === "update" && !values.id) errors.push("Task id is required.");
  return errors.length ? { ok: false, values, errors } : { ok: true, values };
}

export function validateSettings(values: SettingsFormValues): ValidationResult<SettingsFormValues> {
  const errors: string[] = [];
  if (!values.content.trim()) errors.push("Settings content is required.");
  if (values.content.trim()) {
    try {
      parseSettingsText(values.content);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return errors.length ? { ok: false, values, errors } : { ok: true, values };
}

export function validateAgent(values: AgentFormValues, mode: "create" | "update"): ValidationResult<AgentFormValues> {
  const errors: string[] = [];
  if (!SAFE_NAME.test(values.name)) errors.push("Name must use lowercase letters, numbers, and hyphens only.");
  if (!values.content.trim()) errors.push("Agent content is required.");
  if (values.content.trim()) {
    try {
      matter(values.content);
    } catch (error) {
      errors.push(`Agent markdown/frontmatter could not be parsed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (SAFE_NAME.test(values.name)) {
    const exists = existsSync(localAgentPath(values.name));
    if (mode === "create" && exists) errors.push(`Agent already exists: ${values.name}`);
    if (mode === "update" && !exists) errors.push(`Agent does not exist: ${values.name}`);
  }
  return errors.length ? { ok: false, values, errors } : { ok: true, values };
}

export async function createAutomation(values: AutomationFormValues): Promise<void> {
  await writeAtomic(automationPath(values.name), automationMarkdown(values));
}

export async function updateAutomation(name: string, values: AutomationFormValues): Promise<void> {
  assertAutomationName(name);
  if (name !== values.name) throw new Error("Renaming automations is not supported. Create a new automation instead.");
  await writeAtomic(automationPath(name), automationMarkdown(values));
}

export async function deleteAutomation(name: string): Promise<void> {
  assertAutomationName(name);
  await rm(automationPath(name), { force: false });
}

export async function createAgent(values: AgentFormValues): Promise<void> {
  await writeAtomic(localAgentPath(values.name), values.content.trimEnd() + "\n");
}

export async function createProject(values: ProjectFormValues): Promise<void> {
  await writeProject(projectFromValues(values));
}

export async function updateProject(id: string, values: ProjectFormValues): Promise<void> {
  assertProjectName(id);
  if (id !== values.id) throw new Error("Renaming projects is not supported. Create a new project instead.");
  await writeProject(projectFromValues(values));
}

export async function createTask(values: TaskFormValues): Promise<AgentTask> {
  const now = new Date().toISOString();
  const id = values.id || generateTaskId(values.title);
  const task = taskFromValues({ ...values, id }, now, now, 0);
  await writeTask(task);
  return task;
}

export async function updateSettings(values: SettingsFormValues): Promise<void> {
  // Re-parse immediately before writing so invalid YAML cannot corrupt the previous settings file.
  parseSettingsText(values.content);
  await writeAtomic(settingsPath(), values.content.trimEnd() + "\n");
}

export async function updateTaskFile(project: string, id: string, values: TaskFormValues): Promise<void> {
  assertProjectName(project);
  assertTaskId(id);
  if (project !== values.project || id !== values.id) throw new Error("Renaming or moving tasks is not supported. Create a new task instead.");
  const current = await loadTask(project, id);
  await writeTask(taskFromValues(values, current.created_at, new Date().toISOString(), current.attempts, current.claimed_at, current.run_id));
}

export async function setTaskStatus(project: string, id: string, status: string): Promise<void> {
  assertProjectName(project);
  assertTaskId(id);
  if (!TASK_STATUSES.includes(status as TaskStatus)) throw new Error(`Invalid task status: ${status}`);
  await transitionTaskStatus(project, id, status as TaskStatus);
}

export async function updateAgent(name: string, values: AgentFormValues): Promise<void> {
  assertAgentName(name);
  if (name !== values.name) throw new Error("Renaming agents is not supported. Create a new agent instead.");
  await writeAtomic(localAgentPath(name), values.content.trimEnd() + "\n");
}

export async function deleteAgent(name: string): Promise<void> {
  assertAgentName(name);
  const automations = await listAutomations();
  const users = automations.filter((automation) => automation.agent === name).map((automation) => automation.name);
  if (users.length) throw new Error(`Cannot delete agent ${name}; used by automation(s): ${users.join(", ")}`);
  await rm(path.join(agentsDir(), name), { recursive: true, force: false });
}

export async function readAutomationRaw(name: string): Promise<AutomationFormValues> {
  assertAutomationName(name);
  const raw = await readFile(automationPath(name), "utf8");
  const parsed = matter(raw);
  return {
    name,
    agent: String(parsed.data.agent || ""),
    schedule: String(parsed.data.schedule || "manual"),
    model: parsed.data.model ? String(parsed.data.model) : "",
    prompt: parsed.content.trim(),
  };
}

export async function readAgentRaw(name: string): Promise<AgentFormValues> {
  assertAgentName(name);
  return { name, content: await readFile(localAgentPath(name), "utf8") };
}

export async function readProjectRaw(id: string): Promise<ProjectFormValues> {
  const project = await loadProject(id);
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    default_agent: project.default_agent || "",
    body: project.body,
  };
}

export async function readTaskRaw(project: string, id: string): Promise<TaskFormValues> {
  const task = await loadTask(project, id);
  return {
    id: task.id,
    project: task.project,
    title: task.title,
    status: task.status,
    assignee: task.assignee,
    priority: task.priority,
    body: task.body,
  };
}

export async function readSettingsRaw(): Promise<SettingsFormValues> {
  if (!existsSync(settingsPath())) return { content: defaultSettingsText() };
  return { content: await readFile(settingsPath(), "utf8") };
}

export function defaultAgentContent(name: string): string {
  return `---\nname: ${name || "new-agent"}\ndescription: Describe this agent's role.\nallowedIntents: []\n---\n\n## Instructions\n\nDescribe what this agent does, how it should decide, and when it may use connectors.\n`;
}

export function defaultProjectBody(name: string): string {
  return `# ${name || "Project"}\n\nDescribe the project context, constraints, and definition of done for assigned tasks.\n`;
}

export async function runNow(name: string): Promise<{ stdout: string; stderr: string }> {
  assertAutomationName(name);
  return await new Promise((resolve, reject) => {
    execFile("pnpm", ["runner", name], { cwd: repoRoot(), env: process.env, timeout: 1000 * 60 * 30 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Run failed: ${error.message}\n\nstdout:\n${stdout}\n\nstderr:\n${stderr}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function projectFromValues(values: ProjectFormValues): Project {
  return {
    id: values.id,
    name: values.name,
    description: values.description,
    default_agent: values.default_agent || undefined,
    body: values.body,
  };
}

function taskFromValues(values: TaskFormValues, createdAt: string, updatedAt: string, attempts: number, claimedAt?: string, runId?: string): AgentTask {
  return {
    id: values.id,
    title: values.title,
    project: values.project,
    status: values.status as TaskStatus,
    assignee: values.assignee,
    priority: values.priority as AgentTask["priority"],
    created_at: createdAt,
    updated_at: updatedAt,
    claimed_at: claimedAt,
    run_id: runId,
    attempts,
    body: values.body,
  };
}

function automationMarkdown(values: AutomationFormValues): string {
  const lines = ["---", `agent: ${JSON.stringify(values.agent)}`, `schedule: ${JSON.stringify(values.schedule || "manual")}`];
  if (values.model) lines.push(`model: ${JSON.stringify(values.model)}`);
  lines.push("---", "", values.prompt.trim(), "");
  return lines.join("\n");
}

function parseScheduleForm(form: URLSearchParams): string {
  const cadence = String(form.get("scheduleCadence") || "").trim();
  if (!cadence) return String(form.get("schedule") || "manual").trim();
  if (cadence === "manual") return "manual";
  if (cadence === "custom") return String(form.get("schedule") || "manual").trim();

  const time = String(form.get("scheduleTime") || "09:00").trim();
  const match = time.match(/^(\d{2}):(\d{2})$/);
  const hour = match ? Number(match[1]) : 9;
  const minute = match ? Number(match[2]) : 0;
  const safeHour = Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 9;
  const safeMinute = Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : 0;

  if (cadence === "hourly") return `${safeMinute} * * * *`;
  if (cadence === "daily") return `${safeMinute} ${safeHour} * * *`;
  if (cadence === "weekly") {
    const weekday = Number(form.get("scheduleWeekday") || 1);
    const safeWeekday = Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : 1;
    return `${safeMinute} ${safeHour} * * ${safeWeekday}`;
  }
  return String(form.get("schedule") || "manual").trim();
}

function isValidSchedule(value: string): boolean {
  if (value === "manual") return true;
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  return parts.every((part) => /^[\d*,/\-]+$/.test(part));
}

async function writeAtomic(file: string, content: string): Promise<void> {
  const dir = path.dirname(file);
  await mkdir(dir, { recursive: true });
  const temp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  await writeFile(temp, content, "utf8");
  await rename(temp, file);
}
