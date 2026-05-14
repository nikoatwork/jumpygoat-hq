import {
  CoreError,
  assertAgentName,
  assertAutomationName,
  assertBoardName,
  assertTaskId,
  createAgent as coreCreateAgent,
  createAutomation as coreCreateAutomation,
  createBoard as coreCreateBoard,
  createTask as coreCreateTask,
  defaultAgentContent,
  defaultBoardBody,
  deleteAgent as coreDeleteAgent,
  deleteAutomation as coreDeleteAutomation,
  getAgent,
  getAutomation,
  getBoard,
  getSettings,
  getTask,
  runAutomationNow,
  updateAgent as coreUpdateAgent,
  updateAutomation as coreUpdateAutomation,
  updateBoard as coreUpdateBoard,
  updateSettings as coreUpdateSettings,
  updateTask as coreUpdateTask,
  updateTaskStatus,
  validateAgentInput,
  validateAutomationInput,
  validateBoardInput,
  validateTaskInput,
  type TaskDto,
  type TaskPriority,
  type TaskStatus,
} from "@jumpygoat-hq/core";
import { parseSettingsText } from "../../shared/settings.js";

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

export type BoardFormValues = {
  id: string;
  name: string;
  description: string;
  default_agent: string;
  body: string;
};

export type ProjectFormValues = BoardFormValues;

export type TaskFormValues = {
  id: string;
  board: string;
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

export { assertAgentName, assertAutomationName, assertBoardName, assertTaskId, defaultAgentContent, defaultBoardBody };
export const assertProjectName = assertBoardName;
export const defaultProjectBody = defaultBoardBody;

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

export function parseBoardForm(form: URLSearchParams, fallbackId = ""): BoardFormValues {
  const id = String(form.get("id") || fallbackId).trim();
  return {
    id,
    name: String(form.get("name") || id).trim(),
    description: String(form.get("description") || "").trim(),
    default_agent: String(form.get("default_agent") || "").trim(),
    body: String(form.get("body") || ""),
  };
}

export const parseProjectForm = parseBoardForm;

export function parseTaskForm(form: URLSearchParams, fallbackBoard = "", fallbackId = ""): TaskFormValues {
  const board = String(form.get("board") || form.get("project") || fallbackBoard).trim();
  return {
    id: String(form.get("id") || fallbackId).trim(),
    board,
    project: board,
    title: String(form.get("title") || "").trim(),
    status: String(form.get("status") || "not-yet").trim(),
    assignee: String(form.get("assignee") || "").trim(),
    priority: String(form.get("priority") || "normal").trim(),
    body: String(form.get("body") || ""),
  };
}

export function parseSettingsForm(form: URLSearchParams): SettingsFormValues {
  return { content: String(form.get("content") || "") };
}

export async function validateAutomation(values: AutomationFormValues, mode: "create" | "update"): Promise<ValidationResult<AutomationFormValues>> {
  try {
    await validateAutomationInput(automationInput(values), mode);
    return { ok: true, values };
  } catch (error) {
    return { ok: false, values, errors: validationMessages(error) };
  }
}

export function validateAgent(values: AgentFormValues, mode: "create" | "update"): ValidationResult<AgentFormValues> {
  try {
    validateAgentInput({ name: values.name, content: values.content }, mode);
    return { ok: true, values };
  } catch (error) {
    return { ok: false, values, errors: validationMessages(error) };
  }
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

export async function validateBoard(values: BoardFormValues, mode: "create" | "update"): Promise<ValidationResult<BoardFormValues>> {
  try {
    validateBoardInput(boardInput(values), mode);
    return { ok: true, values };
  } catch (error) {
    return { ok: false, values, errors: validationMessages(error) };
  }
}

export const validateProject = validateBoard;

export function validateTask(values: TaskFormValues, mode: "create" | "update"): ValidationResult<TaskFormValues> {
  try {
    validateTaskInput(taskInput(values), mode);
    return { ok: true, values };
  } catch (error) {
    return { ok: false, values, errors: validationMessages(error) };
  }
}

export async function createAutomation(values: AutomationFormValues): Promise<void> {
  await coreCreateAutomation(automationInput(values));
}

export async function updateAutomation(name: string, values: AutomationFormValues): Promise<void> {
  await coreUpdateAutomation(name, automationInput(values));
}

export async function deleteAutomation(name: string): Promise<void> {
  await coreDeleteAutomation(name);
}

export async function createAgent(values: AgentFormValues): Promise<void> {
  await coreCreateAgent({ name: values.name, content: values.content });
}

export async function updateAgent(name: string, values: AgentFormValues): Promise<void> {
  await coreUpdateAgent(name, { name: values.name, content: values.content });
}

export async function deleteAgent(name: string): Promise<void> {
  await coreDeleteAgent(name);
}

export async function createBoard(values: BoardFormValues): Promise<void> {
  await coreCreateBoard(boardInput(values));
}

export const createProject = createBoard;

export async function updateBoard(id: string, values: BoardFormValues): Promise<void> {
  await coreUpdateBoard(id, boardInput(values));
}

export const updateProject = updateBoard;

export async function createTask(values: TaskFormValues): Promise<TaskDto> {
  return await coreCreateTask(taskInput(values));
}

export async function updateTaskFile(board: string, id: string, values: TaskFormValues): Promise<void> {
  await coreUpdateTask(board, id, { ...taskInput(values), id });
}

export async function setTaskStatus(board: string, id: string, status: string): Promise<void> {
  await updateTaskStatus(board, id, { status: status as TaskStatus });
}

export async function updateSettings(values: SettingsFormValues): Promise<void> {
  await coreUpdateSettings({ content: values.content });
}

export async function readAutomationRaw(name: string): Promise<AutomationFormValues> {
  const automation = await getAutomation(name, { includeRaw: true });
  return {
    name: automation.name,
    agent: automation.agent,
    schedule: automation.schedule,
    model: automation.model,
    prompt: automation.prompt,
  };
}

export async function readAgentRaw(name: string): Promise<AgentFormValues> {
  const agent = await getAgent(name, { includeRaw: true });
  return { name, content: agent.rawMarkdown || "" };
}

export async function readBoardRaw(id: string): Promise<BoardFormValues> {
  const board = await getBoard(id, { includeRaw: true });
  return {
    id: board.id,
    name: board.name,
    description: board.description,
    default_agent: board.defaultAgent || "",
    body: board.body,
  };
}

export const readProjectRaw = readBoardRaw;

export async function readTaskRaw(board: string, id: string): Promise<TaskFormValues> {
  const task = await getTask(board, id, { includeRaw: true });
  return {
    id: task.id,
    board: task.board,
    project: task.board,
    title: task.title,
    status: task.status,
    assignee: task.assignee,
    priority: task.priority,
    body: task.body,
  };
}

export async function readSettingsRaw(): Promise<SettingsFormValues> {
  const settings = await getSettings();
  return { content: settings.content };
}

export async function runNow(name: string): Promise<{ stdout: string; stderr: string }> {
  return await runAutomationNow(name);
}

function automationInput(values: AutomationFormValues) {
  return { name: values.name, agent: values.agent, schedule: values.schedule, model: values.model || undefined, prompt: values.prompt };
}

function boardInput(values: BoardFormValues) {
  return { id: values.id, name: values.name, description: values.description, defaultAgent: values.default_agent || undefined, body: values.body };
}

function taskInput(values: TaskFormValues, fallbackId?: string) {
  return {
    id: values.id || fallbackId,
    board: values.board,
    title: values.title,
    status: values.status as TaskStatus,
    assignee: values.assignee || undefined,
    priority: values.priority as TaskPriority,
    body: values.body,
  };
}

function validationMessages(error: unknown): string[] {
  if (error instanceof CoreError) return error.fields.length ? error.fields.map((field) => field.message) : [error.message];
  return [error instanceof Error ? error.message : String(error)];
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
