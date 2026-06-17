import type { Automation, ConnectorOverrides } from "./automation.js";
import type { AgentTask, Board } from "./task.js";

export type InvocationSource =
  | { type: "automation"; id: string; schedule?: string | null }
  | { type: "task"; id: string; board: string; taskId: string }
  | { type: "subagent"; id: string; parentRunId: string; rootRunId: string; depth: number; parentAgent: string; targetAgent: string };

export type Invocation = ConnectorOverrides & {
  /** Stable display/source name for traces and legacy run columns. */
  name: string;
  source: InvocationSource;
  agent: string;
  prompt: string;
  model?: string;
  schedule?: string | null;
  workdirKey: string;
  parentRunId?: string;
  rootRunId?: string;
  depth?: number;
};

export function invocationFromAutomation(automation: Automation): Invocation {
  return {
    name: automation.name,
    source: { type: "automation", id: automation.name, schedule: automation.schedule ?? null },
    agent: automation.agent,
    prompt: automation.prompt,
    model: automation.model,
    schedule: automation.schedule ?? null,
    workdirKey: automation.name,
    web: automation.web,
    notify: automation.notify,
    mail: automation.mail,
    scripts: automation.scripts,
    artifacts: automation.artifacts,
    actors: automation.actors,
    agents: automation.agents,
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
    workdirKey: `task-${task.board}-${task.id}`,
  };
}

export function invocationFromSubagent(args: {
  childRunId: string;
  parentRunId: string;
  rootRunId: string;
  parentAgent: string;
  targetAgent: string;
  prompt: string;
  model?: string;
  depth: number;
}): Invocation {
  const sourceId = `${args.parentRunId}/${args.childRunId}`;
  return {
    name: `subagent-${args.childRunId}`,
    source: {
      type: "subagent",
      id: sourceId,
      parentRunId: args.parentRunId,
      rootRunId: args.rootRunId,
      depth: args.depth,
      parentAgent: args.parentAgent,
      targetAgent: args.targetAgent,
    },
    agent: args.targetAgent,
    prompt: subagentPrompt(args),
    model: args.model,
    schedule: "agent.invoke",
    workdirKey: `subagent-${args.childRunId}`,
    parentRunId: args.parentRunId,
    rootRunId: args.rootRunId,
    depth: args.depth,
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

function subagentPrompt(args: {
  parentRunId: string;
  rootRunId: string;
  parentAgent: string;
  targetAgent: string;
  prompt: string;
  depth: number;
}): string {
  return `You are being invoked as a synchronous child agent by jumpyGoatHq.\n\nParent run: ${args.parentRunId}\nRoot run: ${args.rootRunId}\nParent agent: ${args.parentAgent}\nChild agent: ${args.targetAgent}\nInvocation depth: ${args.depth}\n\n# Delegated subtask\n${args.prompt.trim()}\n\n# Response instructions\n- Answer only the delegated subtask.\n- Be concise and specific; the parent agent will use your response as context.\n- Do not assume you can mutate parent-agent state.\n`;
}

function taskPrompt(board: Board, task: AgentTask): string {
  return `You are executing an jumpyGoatHq assigned task.\n\nBoard: ${board.name} (${board.id})\nTask: ${task.title} (${task.board}/${task.id})\nPriority: ${task.priority}\nStatus at dispatch: ${task.status}\n\n# Board context\n${board.description || "No description."}\n\n${board.body || "No board body."}\n\n# Task body\n${task.body || "No task body."}\n\n# Completion instructions\n- Do the requested work using the repository/workspace available to Pi.\n- Keep changes focused on this task.\n- When finished, summarize what changed and any verification performed.\n- Do not edit the task markdown status yourself; the jumpyGoatHq dispatcher records run status after Pi exits.\n`;
}
