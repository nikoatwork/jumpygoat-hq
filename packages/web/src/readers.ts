import { existsSync } from "node:fs";
import Database from "better-sqlite3";
import { listAgents as coreListAgents, listAutomations as coreListAutomations, listBoards as coreListBoards, listInstalledCronBlocks as coreListInstalledCronBlocks, listTasks as coreListTasks, readTaskHeartbeatCronStatus as coreReadTaskHeartbeatCronStatus, type BoardDto, type TaskDto } from "@jumpygoat-hq/core";
import { dbPath, settingsPath } from "./paths.js";
import type { AgentTask, Board } from "../../shared/tasks.js";
import { loadSettings, type InstanceSettings } from "../../shared/settings.js";
import { nextOccurrences } from "./schedule.js";

export type AutomationView = {
  name: string;
  agent: string;
  schedule: string;
  model: string;
  promptPreview: string;
  warning?: string;
};

export type AgentView = {
  name: string;
  description: string;
  path: string;
  contextCount: number;
  warning?: string;
};

export type CronBlock = {
  name: string;
  block: string;
  line: string;
  warning?: string;
};

export type TaskHeartbeatCronStatus = {
  installed: boolean;
  block: string;
  line: string;
  warning?: string;
};

export type ScheduleOccurrenceView = {
  automation: string;
  agent: string;
  schedule: string;
  installed: boolean;
  time: Date;
};

export type ScheduledRunView = {
  name: string;
  agent: string;
  agentDescription: string;
  schedule: string;
  model: string;
  installed: boolean;
  manual: boolean;
  warnings: string[];
  upcoming: Date[];
};

export type SchedulePageView = {
  from: Date;
  until: Date;
  runs: ScheduledRunView[];
  occurrences: ScheduleOccurrenceView[];
  orphanCronBlocks: CronBlock[];
  warnings: string[];
};

export type RunRow = {
  id: string;
  automation: string;
  source_type?: string | null;
  source_id?: string | null;
  agent?: string | null;
  model: string | null;
  requested_model?: string | null;
  resolved_model?: string | null;
  model_profile?: string | null;
  model_resolution_warning?: string | null;
  schedule: string | null;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  exit_code: number | null;
  signal: string | null;
  output_text: string;
  trace_text: string;
  error_text: string;
  connector_actions_json?: string;
  parent_run_id?: string | null;
  root_run_id?: string | null;
  depth?: number | null;
  project?: string | null;
  task_id?: string | null;
  usage_input_tokens?: number | null;
  usage_output_tokens?: number | null;
  usage_reasoning_tokens?: number | null;
  usage_cache_read_tokens?: number | null;
  usage_cache_write_tokens?: number | null;
  usage_total_tokens?: number | null;
  usage_cost_total?: number | null;
  usage_currency?: string | null;
  usage_provider?: string | null;
  usage_model?: string | null;
  usage_json?: string | null;
};

export type SettingsView = {
  path: string;
  exists: boolean;
  settings?: InstanceSettings;
  error?: string;
};

export type UsageSummaryRow = {
  key: string;
  profile: string;
  resolvedModel: string;
  piModel: string;
  provider: string;
  runs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  costTotal: number | null;
  currency: string;
};

export type BoardView = Board & {
  taskCount: number;
  warning?: string;
};

export type ProjectView = BoardView;

export type TaskView = AgentTask & {
  latestRun?: RunRow | null;
  warning?: string;
};

export async function listAutomations(): Promise<AutomationView[]> {
  return (await coreListAutomations()).map((automation) => ({
    name: automation.name,
    agent: automation.agent,
    schedule: automation.schedule,
    model: automation.model,
    promptPreview: automation.promptPreview,
    warning: automation.warning,
  }));
}

export async function listAgents(): Promise<AgentView[]> {
  return (await coreListAgents()).map((agent) => ({
    name: agent.name,
    description: agent.description,
    path: agent.path || "",
    contextCount: agent.contextCount,
    warning: agent.warning,
  }));
}

export function listInstalledCronBlocks(): CronBlock[] {
  return coreListInstalledCronBlocks();
}

export function readTaskHeartbeatCronStatus(): TaskHeartbeatCronStatus {
  return coreReadTaskHeartbeatCronStatus();
}

export async function readSchedulePageView(windowDays = 7, now = new Date()): Promise<SchedulePageView> {
  const [automations, agents] = await Promise.all([listAutomations(), listAgents()]);
  const agentDescriptions = new Map(agents.map((agent) => [agent.name, agent.description]));
  const cronBlocks = listInstalledCronBlocks();
  const cronByName = new Map(cronBlocks.map((block) => [block.name, block]));
  const automationNames = new Set(automations.map((automation) => automation.name));
  const from = new Date(now.getTime());
  const until = new Date(now.getTime());
  until.setDate(until.getDate() + windowDays);

  const runs: ScheduledRunView[] = [];
  const occurrences: ScheduleOccurrenceView[] = [];

  for (const automation of automations) {
    const installedBlock = cronByName.get(automation.name);
    const installed = Boolean(installedBlock);
    const schedule = automation.schedule || "manual";
    const manual = schedule === "manual";
    const warnings = [automation.warning, installedBlock?.warning].filter((warning): warning is string => Boolean(warning));

    if (automation.agent && !agentDescriptions.has(automation.agent)) warnings.push(`Referenced agent not found: ${automation.agent}.`);
    if (manual && installed) warnings.push("Manual automation has an installed cron block.");
    if (!manual && !installed) warnings.push("Cron schedule is not installed in the user crontab.");

    const expanded = manual ? { occurrences: [] as Date[] } : nextOccurrences(schedule, from, until, 200);
    if (expanded.warning) warnings.push(expanded.warning);

    for (const time of expanded.occurrences) {
      occurrences.push({ automation: automation.name, agent: automation.agent, schedule, installed, time });
    }

    runs.push({
      name: automation.name,
      agent: automation.agent,
      agentDescription: agentDescriptions.get(automation.agent) || "",
      schedule,
      model: automation.model || "default",
      installed,
      manual,
      warnings,
      upcoming: expanded.occurrences,
    });
  }

  occurrences.sort((a, b) => a.time.getTime() - b.time.getTime() || a.automation.localeCompare(b.automation));
  const orphanCronBlocks = cronBlocks.filter((block) => !automationNames.has(block.name));
  const warnings = [
    ...orphanCronBlocks.map((block) => `Installed cron block has no matching automation: ${block.name}.`),
    ...cronBlocks.filter((block) => block.warning).map((block) => `Cron block ${block.name}: ${block.warning}`),
  ];

  return { from, until, runs, occurrences, orphanCronBlocks, warnings };
}

export async function listBoards(): Promise<BoardView[]> {
  return (await coreListBoards()).map(boardDtoToView);
}

export const listProjects = listBoards;

export async function readBoard(name: string): Promise<BoardView | null> {
  const board = (await listBoards()).find((entry) => entry.id === name);
  return board || null;
}

export const readProject = readBoard;

export async function listTasks(boardFilter?: string): Promise<TaskView[]> {
  const latestRuns = latestTaskRuns();
  return (await coreListTasks({ board: boardFilter })).map((task) => ({
    ...taskDtoToView(task),
    latestRun: latestRuns.get(`${task.board}/${task.id}`) || null,
  }));
}

export async function readTask(board: string, id: string): Promise<TaskView | null> {
  const task = (await listTasks(board)).find((entry) => entry.id === id);
  return task || null;
}

function boardDtoToView(board: BoardDto): BoardView {
  return {
    id: board.id,
    name: board.name,
    description: board.description,
    default_agent: board.defaultAgent,
    body: board.body,
    path: board.path,
    taskCount: board.taskCount || 0,
    warning: board.warning,
  };
}

function taskDtoToView(task: TaskDto): TaskView {
  return {
    id: task.id,
    title: task.title,
    board: task.board,
    project: task.board,
    status: task.status,
    assignee: task.assignee,
    priority: task.priority,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
    claimed_at: task.claimedAt,
    run_id: task.runId,
    attempts: task.attempts,
    path: task.path,
    body: task.body,
    warning: task.warning,
  };
}

function latestTaskRuns(): Map<string, RunRow> {
  const rows = listRuns(500).filter((run) => run.project && run.task_id);
  return new Map(rows.map((run) => [`${run.project}/${run.task_id}`, run]));
}

export function readSettingsView(): SettingsView {
  const file = settingsPath();
  try {
    return { path: file, exists: existsSync(file), settings: loadSettings(file) };
  } catch (error) {
    return { path: file, exists: existsSync(file), error: error instanceof Error ? error.message : String(error) };
  }
}

export function listModelProfileKeys(): string[] {
  const view = readSettingsView();
  return view.settings ? Object.keys(view.settings.modelProfiles).sort() : [];
}

export function usageSummary(limit = 1000): UsageSummaryRow[] {
  const runs = listRuns(limit).filter((run) => hasAnyUsage(run));
  const groups = new Map<string, UsageSummaryRow>();
  for (const run of runs) {
    const profile = run.model_profile || "";
    const resolvedModel = run.resolved_model || run.model || "";
    const piModel = run.usage_model || "";
    const provider = run.usage_provider || "";
    const key = [profile, resolvedModel, piModel, provider].map((value) => value || "unknown").join("|");
    const row = groups.get(key) || {
      key,
      profile,
      resolvedModel,
      piModel,
      provider,
      runs: 0,
      inputTokens: null,
      outputTokens: null,
      reasoningTokens: null,
      totalTokens: null,
      costTotal: null,
      currency: run.usage_currency || "",
    };
    row.runs += 1;
    row.inputTokens = addNullable(row.inputTokens, run.usage_input_tokens);
    row.outputTokens = addNullable(row.outputTokens, run.usage_output_tokens);
    row.reasoningTokens = addNullable(row.reasoningTokens, run.usage_reasoning_tokens);
    row.totalTokens = addNullable(row.totalTokens, run.usage_total_tokens);
    row.costTotal = addNullable(row.costTotal, run.usage_cost_total);
    row.currency = row.currency || run.usage_currency || "";
    groups.set(key, row);
  }
  return [...groups.values()].sort((a, b) => b.runs - a.runs || a.key.localeCompare(b.key));
}

export function listRuns(limit = 50): RunRow[] {
  if (!existsSync(dbPath())) return [];
  const db = new Database(dbPath(), { readonly: true });
  try {
    return db.prepare("select * from runs order by started_at desc limit ?").all(limit) as RunRow[];
  } finally {
    db.close();
  }
}

export function getRun(id: string): RunRow | null {
  if (!existsSync(dbPath())) return null;
  const db = new Database(dbPath(), { readonly: true });
  try {
    return (db.prepare("select * from runs where id = ?").get(id) as RunRow | undefined) || null;
  } finally {
    db.close();
  }
}

export function runAgentName(run: RunRow): string {
  return String(run.agent || "");
}

function hasAnyUsage(run: RunRow): boolean {
  return [
    run.usage_input_tokens,
    run.usage_output_tokens,
    run.usage_reasoning_tokens,
    run.usage_cache_read_tokens,
    run.usage_cache_write_tokens,
    run.usage_total_tokens,
    run.usage_cost_total,
  ].some((value) => value != null);
}

function addNullable(current: number | null, value: number | null | undefined): number | null {
  if (value == null) return current;
  return (current ?? 0) + value;
}
