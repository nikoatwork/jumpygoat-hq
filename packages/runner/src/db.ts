import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { dbPath } from "./paths.js";
export { dbPath } from "./paths.js";
import type { AgentMeta } from "./agent.js";
import type { Automation } from "./automation.js";

export function openDb(): Database.Database {
  const file = dbPath();
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  setupDb(db);
  return db;
}

export function setupDb(db?: Database.Database): void {
  const target = db ?? openRawDb();
  target.exec(`
    create table if not exists runs (
      id text primary key,
      automation text not null,
      agent text not null,
      skill text,
      project text,
      task_id text,
      model text,
      schedule text,
      status text not null,
      started_at text not null,
      finished_at text,
      duration_ms integer,
      exit_code integer,
      signal text,
      output_text text not null default '',
      trace_text text not null default '',
      error_text text not null default '',
      connector_actions_json text not null default '[]'
    );

    create index if not exists runs_started_at_idx on runs(started_at desc);
    create index if not exists runs_automation_idx on runs(automation, started_at desc);
  `);
  ensureColumn(target, "runs", "agent", "text");
  ensureColumn(target, "runs", "project", "text");
  ensureColumn(target, "runs", "task_id", "text");
  ensureColumn(target, "runs", "connector_actions_json", "text not null default '[]'");
  target.exec("create index if not exists runs_task_idx on runs(project, task_id, started_at desc)");
  if (!db) target.close();
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string): void {
  const columns = db.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`alter table ${table} add column ${column} ${definition}`);
  }
}

function openRawDb(): Database.Database {
  const file = dbPath();
  mkdirSync(path.dirname(file), { recursive: true });
  return new Database(file);
}

export function insertRun(db: Database.Database, args: {
  runId: string;
  automation: Automation;
  agent: AgentMeta;
  model?: string;
  startedAt: string;
  project?: string;
  taskId?: string;
}): void {
  db.prepare(`
    insert into runs (id, automation, agent, skill, project, task_id, model, schedule, status, started_at)
    values (@id, @automation, @agent, @skill, @project, @task_id, @model, @schedule, 'running', @started_at)
  `).run({
    id: args.runId,
    automation: args.automation.name,
    agent: args.automation.agent,
    skill: args.automation.agent,
    project: args.project ?? null,
    task_id: args.taskId ?? null,
    model: args.model ?? null,
    schedule: args.automation.schedule ?? null,
    started_at: args.startedAt,
  });
}

export function finishRun(db: Database.Database, args: {
  runId: string;
  status: "ok" | "error";
  finishedAt: string;
  durationMs: number;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  outputText: string;
  traceText: string;
  errorText: string;
  connectorActionsJson?: string;
}): void {
  db.prepare(`
    update runs
    set status = @status,
        finished_at = @finished_at,
        duration_ms = @duration_ms,
        exit_code = @exit_code,
        signal = @signal,
        output_text = @output_text,
        trace_text = @trace_text,
        error_text = @error_text,
        connector_actions_json = @connector_actions_json
    where id = @id
  `).run({
    id: args.runId,
    status: args.status,
    finished_at: args.finishedAt,
    duration_ms: args.durationMs,
    exit_code: args.exitCode,
    signal: args.signal,
    output_text: args.outputText,
    trace_text: args.traceText,
    error_text: args.errorText,
    connector_actions_json: args.connectorActionsJson ?? "[]",
  });
}
