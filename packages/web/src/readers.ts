import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import matter from "gray-matter";
import { agentsDir, automationsDir, dbPath, projectsDir, settingsPath, tasksDir } from "./paths.js";
import { parseProjectMarkdown, parseTaskMarkdown, type AgentTask, type Project } from "../../shared/tasks.js";
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

export type ProjectView = Project & {
  taskCount: number;
  warning?: string;
};

export type TaskView = AgentTask & {
  latestRun?: RunRow | null;
  warning?: string;
};

export async function listAutomations(): Promise<AutomationView[]> {
  if (!existsSync(automationsDir())) return [];
  const files = (await readdir(automationsDir())).filter((f) => f.endsWith(".md") && f !== "README.md").sort();
  return Promise.all(files.map(readAutomationFile));
}

async function readAutomationFile(file: string): Promise<AutomationView> {
  const name = file.replace(/\.md$/, "");
  try {
    const raw = await readFile(path.join(automationsDir(), file), "utf8");
    const parsed = matter(raw);
    return {
      name,
      agent: String(parsed.data.agent || ""),
      schedule: String(parsed.data.schedule || "manual"),
      model: parsed.data.model ? String(parsed.data.model) : "",
      promptPreview: parsed.content.trim().replace(/\s+/g, " ").slice(0, 160),
    };
  } catch (error) {
    return { name, agent: "", schedule: "", model: "", promptPreview: "", warning: String(error) };
  }
}

export async function listAgents(): Promise<AgentView[]> {
  if (!existsSync(agentsDir())) return [];
  const entries = await readdir(agentsDir());
  const agents: AgentView[] = [];
  for (const entry of entries.sort()) {
    const agentFile = path.join(agentsDir(), entry, "AGENT.md");
    try {
      if (!existsSync(agentFile) || !(await stat(agentFile)).isFile()) continue;
      const raw = await readFile(agentFile, "utf8");
      const parsed = matter(raw);
      agents.push({
        name: String(parsed.data.name || entry),
        description: String(parsed.data.description || ""),
        path: agentFile,
        contextCount: await countContextFiles(entry),
      });
    } catch (error) {
      agents.push({ name: entry, description: "", path: agentFile, contextCount: 0, warning: String(error) });
    }
  }
  return agents;
}

async function countContextFiles(agent: string): Promise<number> {
  const dir = path.join(agentsDir(), agent, "context");
  if (!existsSync(dir)) return 0;
  return (await readdir(dir)).filter((file) => file.endsWith(".md")).length;
}

export function listInstalledCronBlocks(): CronBlock[] {
  let text = "";
  try {
    text = execFileSync("crontab", ["-l"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return [];
  }

  const lines = text.split("\n");
  const blocks: CronBlock[] = [];
  let current: { name: string; lines: string[] } | undefined;

  const pushBlock = (block: { name: string; lines: string[] }, warning?: string) => {
    blocks.push({
      name: block.name,
      block: block.lines.join("\n"),
      line: block.lines.find((l) => l && !l.startsWith("#")) || "",
      warning,
    });
  };

  for (const line of lines) {
    const start = line.match(/^# agenthq:start ([^\s]+)$/);
    const end = line.match(/^# agenthq:end ([^\s]+)$/);

    if (start) {
      if (current) pushBlock(current, "Missing end marker before next AgentHQ cron block.");
      current = { name: start[1]!, lines: [line] };
      continue;
    }

    if (end) {
      if (!current) {
        pushBlock({ name: end[1]!, lines: [line] }, "End marker without matching start marker.");
        continue;
      }
      current.lines.push(line);
      if (end[1] === current.name) {
        pushBlock(current);
      } else {
        pushBlock(current, `End marker name mismatch: expected ${current.name}, got ${end[1]}.`);
      }
      current = undefined;
      continue;
    }

    if (current) current.lines.push(line);
  }

  if (current) pushBlock(current, "Missing end marker for AgentHQ cron block.");
  return blocks;
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

export async function listProjects(): Promise<ProjectView[]> {
  if (!existsSync(projectsDir())) return [];
  const entries = await readdir(projectsDir(), { withFileTypes: true });
  const projects: ProjectView[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const file = path.join(projectsDir(), entry.name, "PROJECT.md");
    try {
      const raw = await readFile(file, "utf8");
      const project = parseProjectMarkdown(entry.name, raw, file);
      projects.push({ ...project, taskCount: await countProjectTasks(entry.name) });
    } catch (error) {
      projects.push({ id: entry.name, name: entry.name, description: "", body: "", path: file, taskCount: 0, warning: String(error) });
    }
  }
  return projects;
}

export async function readProject(name: string): Promise<ProjectView | null> {
  const project = (await listProjects()).find((entry) => entry.id === name);
  return project || null;
}

export async function listTasks(projectFilter?: string): Promise<TaskView[]> {
  const projects = projectFilter ? [projectFilter] : (await listProjects()).map((project) => project.id);
  const latestRuns = latestTaskRuns();
  const tasks: TaskView[] = [];
  for (const project of projects) {
    const dir = tasksDir(project);
    if (!existsSync(dir)) continue;
    const files = await readdir(dir, { withFileTypes: true });
    for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!file.isFile() || !file.name.endsWith(".md")) continue;
      const id = file.name.replace(/\.md$/, "");
      const filePath = path.join(dir, file.name);
      try {
        const raw = await readFile(filePath, "utf8");
        const task = parseTaskMarkdown(project, id, raw, filePath);
        tasks.push({ ...task, latestRun: latestRuns.get(`${project}/${id}`) || null });
      } catch (error) {
        tasks.push({
          id,
          title: id,
          project,
          status: "failed",
          assignee: "",
          priority: "normal",
          created_at: "",
          updated_at: "",
          attempts: 0,
          path: filePath,
          body: "",
          latestRun: latestRuns.get(`${project}/${id}`) || null,
          warning: String(error),
        });
      }
    }
  }
  tasks.sort((a, b) => a.status.localeCompare(b.status) || b.priority.localeCompare(a.priority) || a.id.localeCompare(b.id));
  return tasks;
}

export async function readTask(project: string, id: string): Promise<TaskView | null> {
  const task = (await listTasks(project)).find((entry) => entry.id === id);
  return task || null;
}

async function countProjectTasks(project: string): Promise<number> {
  const dir = tasksDir(project);
  if (!existsSync(dir)) return 0;
  return (await readdir(dir)).filter((file) => file.endsWith(".md")).length;
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
