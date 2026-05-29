import type { Automation, ConnectorOverrides } from "./automation.js";
import type { AgentTask, Board } from "./task.js";

export type InvocationSource =
  | { type: "automation"; id: string; schedule?: string | null }
  | { type: "task"; id: string; board: string; taskId: string };

export type Invocation = ConnectorOverrides & {
  /** Stable display/source name for traces and legacy run columns. */
  name: string;
  source: InvocationSource;
  agent: string;
  prompt: string;
  model?: string;
  schedule?: string | null;
  workspaceKey: string;
};

export function invocationFromAutomation(automation: Automation): Invocation {
  return {
    name: automation.name,
    source: { type: "automation", id: automation.name, schedule: automation.schedule ?? null },
    agent: automation.agent,
    prompt: automation.prompt,
    model: automation.model,
    schedule: automation.schedule ?? null,
    workspaceKey: automation.name,
    web: automation.web,
    notify: automation.notify,
    mail: automation.mail,
    scripts: automation.scripts,
  };
}

export function invocationFromTask(board: Board, task: AgentTask): Invocation {
  const id = `${task.board}/${task.id}`;
  return {
    name: id,
    source: { type: "task", id, board: task.board, taskId: task.id },
    agent: task.assignee,
    prompt: taskPrompt(board, task),
    schedule: "task-dispatch",
    workspaceKey: `task-${task.board}-${task.id}`,
  };
}

export function invocationBoard(invocation: Invocation): string | undefined {
  return invocation.source.type === "task" ? invocation.source.board : undefined;
}

// Legacy DB compatibility: runs.project stores the board id until the run table is renamed.
export const invocationProject = invocationBoard;

export function invocationTaskId(invocation: Invocation): string | undefined {
  return invocation.source.type === "task" ? invocation.source.taskId : undefined;
}

function taskPrompt(board: Board, task: AgentTask): string {
  return `You are executing an jumpyGoatHq assigned task.\n\nBoard: ${board.name} (${board.id})\nTask: ${task.title} (${task.board}/${task.id})\nPriority: ${task.priority}\nStatus at dispatch: ${task.status}\n\n# Board context\n${board.description || "No description."}\n\n${board.body || "No board body."}\n\n# Task body\n${task.body || "No task body."}\n\n# Completion instructions\n- Do the requested work using the repository/workspace available to Pi.\n- Keep changes focused on this task.\n- When finished, summarize what changed and any verification performed.\n- Do not edit the task markdown status yourself; the jumpyGoatHq dispatcher records run status after Pi exits.\n`;
}
