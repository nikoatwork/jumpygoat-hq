import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths.js";
import type { Automation } from "./automation.js";

export function dbPath(): string {
  const configured = process.env.AGENTHQ_DB_PATH;
  if (!configured) return path.join(repoRoot(), "data", "agenthq.sqlite");
  return path.isAbsolute(configured) ? configured : path.join(repoRoot(), configured);
}

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
      skill text not null,
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
  ensureColumn(target, "runs", "connector_actions_json", "text not null default '[]'");
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
  startedAt: string;
}): void {
  db.prepare(`
    insert into runs (id, automation, skill, model, schedule, status, started_at)
    values (@id, @automation, @skill, @model, @schedule, 'running', @started_at)
  `).run({
    id: args.runId,
    automation: args.automation.name,
    skill: args.automation.skill,
    model: args.automation.model ?? null,
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
