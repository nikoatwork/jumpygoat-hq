export type TaskStatus = "not-yet" | "ready" | "working-on-it" | "done";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export type Board = {
  id: string;
  name: string;
  description: string;
  default_agent?: string;
  path?: string;
  body: string;
  raw?: string;
};

export type Project = Board;

export type AgentTask = {
  id: string;
  title: string;
  board: string;
  /** Legacy alias while run DB/project metadata is renamed. */
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

export const SAFE_BOARD_NAME: RegExp;
export const SAFE_PROJECT_NAME: RegExp;
export const SAFE_TASK_ID: RegExp;
export const TASK_STATUSES: TaskStatus[];
export const TASK_STATUS_LABELS: Record<TaskStatus, string>;
export const TASK_PRIORITIES: TaskPriority[];
export const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]>;

export function taskStatusLabel(status: string): string;
export function normalizeTaskStatus(status: string): TaskStatus | string;
export function assertBoardName(name: string): void;
export const assertProjectName: typeof assertBoardName;
export function assertTaskId(id: string): void;
export function assertTaskStatus(status: string): asserts status is TaskStatus;
export function canTransitionTask(from: TaskStatus, to: TaskStatus): boolean;
export function assertTaskTransition(from: TaskStatus, to: TaskStatus): void;
export function generateTaskId(title: string, now?: Date): string;
export function loadBoard(name: string): Promise<Board>;
export const loadProject: typeof loadBoard;
export function parseBoardMarkdown(name: string, raw: string, file?: string): Board;
export const parseProjectMarkdown: typeof parseBoardMarkdown;
export function loadTask(board: string, id: string): Promise<AgentTask>;
export function parseTaskMarkdown(board: string, id: string, raw: string, file?: string): AgentTask;
export function boardMarkdown(values: Board): string;
export const projectMarkdown: typeof boardMarkdown;
export function taskMarkdown(task: AgentTask): string;
export function writeBoard(board: Board): Promise<void>;
export const writeProject: typeof writeBoard;
export function writeTask(task: AgentTask): Promise<void>;
export function updateTask(board: string, id: string, updater: (task: AgentTask) => AgentTask, options?: { expectedStatus?: TaskStatus }): Promise<AgentTask>;
export function transitionTaskStatus(board: string, id: string, status: TaskStatus, options?: { expectedStatus?: TaskStatus; force?: boolean }): Promise<AgentTask>;
export function writeAtomic(file: string, content: string): Promise<void>;
export function boardExists(name: string): boolean;
export const projectExists: typeof boardExists;
