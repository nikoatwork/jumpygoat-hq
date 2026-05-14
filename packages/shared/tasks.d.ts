export type TaskStatus = "backlog" | "ready" | "doing" | "review" | "done" | "blocked" | "failed";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type Project = {
  id: string;
  name: string;
  description: string;
  default_agent?: string;
  path?: string;
  body: string;
  raw?: string;
};

export type AgentTask = {
  id: string;
  title: string;
  project: string;
  status: TaskStatus;
  assignee: string;
  priority: TaskPriority;
  created_at: string;
  updated_at: string;
  claimed_at?: string;
  run_id?: string;
  attempts: number;
  path?: string;
  body: string;
  raw?: string;
};

export const SAFE_PROJECT_NAME: RegExp;
export const SAFE_TASK_ID: RegExp;
export const TASK_STATUSES: TaskStatus[];
export const TASK_PRIORITIES: TaskPriority[];
export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]>;

export function assertProjectName(name: string): void;
export function assertTaskId(id: string): void;
export function assertTaskStatus(status: string): asserts status is TaskStatus;
export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean;
export function assertTaskTransition(from: TaskStatus, to: TaskStatus): void;
export function generateTaskId(title: string, now?: Date): string;
export function loadProject(name: string): Promise<Project>;
export function parseProjectMarkdown(name: string, raw: string, file?: string): Project;
export function loadTask(project: string, id: string): Promise<AgentTask>;
export function parseTaskMarkdown(project: string, id: string, raw: string, file?: string): AgentTask;
export function projectMarkdown(values: Project): string;
export function taskMarkdown(task: AgentTask): string;
export function writeProject(project: Project): Promise<void>;
export function writeTask(task: AgentTask): Promise<void>;
export function updateTask(project: string, id: string, updater: (task: AgentTask) => AgentTask, options?: { expectedStatus?: TaskStatus }): Promise<AgentTask>;
export function transitionTaskStatus(project: string, id: string, status: TaskStatus, options?: { expectedStatus?: TaskStatus; force?: boolean }): Promise<AgentTask>;
export function writeAtomic(file: string, content: string): Promise<void>;
export function projectExists(name: string): boolean;
