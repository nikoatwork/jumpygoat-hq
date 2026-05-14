import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { dbPath } from "./paths.js";
export { dbPath } from "./paths.js";
import type { AgentMeta } from "./agent.js";
import type { Invocation } from "./invocation.js";
import { invocationProject, invocationTaskId } from "./invocation.js";
import type { ModelResolution } from "../../shared/settings.js";
import type { RunUsage } from "./usage.js";

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
      source_type text,
      source_id text,
      agent text not null,
      project text,
      task_id text,
      model text,
      requested_model text,
      resolved_model text,
      model_profile text,
      model_resolution_warning text,
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
      connector_actions_json text not null default '[]',
      usage_input_tokens integer,
      usage_output_tokens integer,
      usage_reasoning_tokens integer,
      usage_cache_read_tokens integer,
      usage_cache_write_tokens integer,
      usage_total_tokens integer,
      usage_cost_total real,
      usage_currency text,
      usage_provider text,
      usage_model text,
      usage_json text
    );

    create index if not exists runs_started_at_idx on runs(started_at desc);
    create index if not exists runs_automation_idx on runs(automation, started_at desc);
  `);
  ensureColumn(target, "runs", "agent", "text");
  ensureColumn(target, "runs", "source_type", "text");
  ensureColumn(target, "runs", "source_id", "text");
  ensureColumn(target, "runs", "project", "text");
  ensureColumn(target, "runs", "task_id", "text");
  ensureColumn(target, "runs", "connector_actions_json", "text not null default '[]'");
  ensureColumn(target, "runs", "requested_model", "text");
  ensureColumn(target, "runs", "resolved_model", "text");
  ensureColumn(target, "runs", "model_profile", "text");
  ensureColumn(target, "runs", "model_resolution_warning", "text");
  ensureColumn(target, "runs", "usage_input_tokens", "integer");
  ensureColumn(target, "runs", "usage_output_tokens", "integer");
  ensureColumn(target, "runs", "usage_reasoning_tokens", "integer");
  ensureColumn(target, "runs", "usage_cache_read_tokens", "integer");
  ensureColumn(target, "runs", "usage_cache_write_tokens", "integer");
  ensureColumn(target, "runs", "usage_total_tokens", "integer");
  ensureColumn(target, "runs", "usage_cost_total", "real");
  ensureColumn(target, "runs", "usage_currency", "text");
  ensureColumn(target, "runs", "usage_provider", "text");
  ensureColumn(target, "runs", "usage_model", "text");
  ensureColumn(target, "runs", "usage_json", "text");
  removeColumnIfExists(target, "runs", "sk" + "ill");
  target.exec("create index if not exists runs_task_idx on runs(project, task_id, started_at desc)");
  if (!db) target.close();
}

function ensureColumn(db: Database.Database, table: string, column: string, definition: string): void {
  const columns = db.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`alter table ${table} add column ${column} ${definition}`);
  }
}

function removeColumnIfExists(db: Database.Database, table: string, column: string): void {
  const columns = db.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>;
  if (columns.some((entry) => entry.name === column)) {
    db.exec(`alter table ${table} drop column ${column}`);
  }
}

function openRawDb(): Database.Database {
  const file = dbPath();
  mkdirSync(path.dirname(file), { recursive: true });
  return new Database(file);
}

export function insertRun(db: Database.Database, args: {
  runId: string;
  invocation: Invocation;
  agent: AgentMeta;
  model?: string;
  modelResolution?: ModelResolution;
  startedAt: string;
}): void {
  db.prepare(`
    insert into runs (id, automation, source_type, source_id, agent, project, task_id, model, requested_model, resolved_model, model_profile, model_resolution_warning, schedule, status, started_at)
    values (@id, @automation, @source_type, @source_id, @agent, @project, @task_id, @model, @requested_model, @resolved_model, @model_profile, @model_resolution_warning, @schedule, 'running', @started_at)
  `).run({
    id: args.runId,
    automation: args.invocation.name,
    source_type: args.invocation.source.type,
    source_id: args.invocation.source.id,
    agent: args.invocation.agent,
    project: invocationProject(args.invocation) ?? null,
    task_id: invocationTaskId(args.invocation) ?? null,
    model: args.model ?? null,
    requested_model: args.modelResolution?.requestedModel ?? args.model ?? null,
    resolved_model: args.modelResolution?.resolvedModel ?? args.model ?? null,
    model_profile: args.modelResolution?.profileKey ?? null,
    model_resolution_warning: args.modelResolution?.warning ?? null,
    schedule: args.invocation.schedule ?? null,
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
  usage?: RunUsage | null;
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
        connector_actions_json = @connector_actions_json,
        usage_input_tokens = @usage_input_tokens,
        usage_output_tokens = @usage_output_tokens,
        usage_reasoning_tokens = @usage_reasoning_tokens,
        usage_cache_read_tokens = @usage_cache_read_tokens,
        usage_cache_write_tokens = @usage_cache_write_tokens,
        usage_total_tokens = @usage_total_tokens,
        usage_cost_total = @usage_cost_total,
        usage_currency = @usage_currency,
        usage_provider = @usage_provider,
        usage_model = @usage_model,
        usage_json = @usage_json
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
    usage_input_tokens: args.usage?.inputTokens ?? null,
    usage_output_tokens: args.usage?.outputTokens ?? null,
    usage_reasoning_tokens: args.usage?.reasoningTokens ?? null,
    usage_cache_read_tokens: args.usage?.cacheReadTokens ?? null,
    usage_cache_write_tokens: args.usage?.cacheWriteTokens ?? null,
    usage_total_tokens: args.usage?.totalTokens ?? null,
    usage_cost_total: args.usage?.costTotal ?? null,
    usage_currency: args.usage?.currency ?? null,
    usage_provider: args.usage?.provider ?? null,
    usage_model: args.usage?.model ?? null,
    usage_json: args.usage ? JSON.stringify(args.usage) : null,
  });
}
