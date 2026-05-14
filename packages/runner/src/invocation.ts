import type { Automation, ConnectorOverrides } from "./automation.js";
import type { AgentTask, Project } from "./task.js";

export type InvocationSource =
  | { type: "automation"; id: string; schedule?: string | null }
  | { type: "task"; id: string; project: string; taskId: string };

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
  };
}

export function invocationFromTask(project: Project, task: AgentTask): Invocation {
  const id = `${task.project}/${task.id}`;
  return {
    name: id,
    source: { type: "task", id, project: task.project, taskId: task.id },
    agent: task.assignee,
    prompt: taskPrompt(project, task),
    schedule: "task-dispatch",
    workspaceKey: `task-${task.project}-${task.id}`,
  };
}

export function invocationProject(invocation: Invocation): string | undefined {
  return invocation.source.type === "task" ? invocation.source.project : undefined;
}

export function invocationTaskId(invocation: Invocation): string | undefined {
  return invocation.source.type === "task" ? invocation.source.taskId : undefined;
}

function taskPrompt(project: Project, task: AgentTask): string {
  return `You are executing an AgentHQ assigned task.\n\nProject: ${project.name} (${project.id})\nTask: ${task.title} (${task.project}/${task.id})\nPriority: ${task.priority}\nStatus at dispatch: ${task.status}\n\n# Project context\n${project.description || "No description."}\n\n${project.body || "No project body."}\n\n# Task body\n${task.body || "No task body."}\n\n# Completion instructions\n- Do the requested work using the repository/workspace available to Pi.\n- Keep changes focused on this task.\n- When finished, summarize what changed and any verification performed.\n- Do not edit the task markdown status yourself; the AgentHQ dispatcher records run status after Pi exits.\n`;
}
