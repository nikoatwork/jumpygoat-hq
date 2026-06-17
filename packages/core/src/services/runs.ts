import { existsSync } from "node:fs";
import Database from "better-sqlite3";
import { dbPath } from "../../../shared/paths.js";
import type { RunDto } from "../dto.js";
import { notFoundError } from "../errors.js";

export type RunListOptions = {
  limit?: number;
  sourceType?: string;
  sourceId?: string;
  automation?: string;
  agent?: string;
  board?: string;
  taskId?: string;
  parentRunId?: string;
  rootRunId?: string;
};

export interface RunService {
  list(options?: RunListOptions): Promise<RunDto[]>;
  get(id: string): Promise<RunDto>;
}

type RunRow = {
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
  connector_actions_json?: string | null;
  parent_run_id?: string | null;
  root_run_id?: string | null;
  depth?: number | null;
  project?: string | null;
  task_id?: string | null;
  usage_json?: string | null;
};

export async function listRuns(options: RunListOptions = {}): Promise<RunDto[]> {
  if (!existsSync(dbPath())) return [];
  const limit = Math.max(1, Math.min(options.limit ?? 50, 1000));
  const where: string[] = [];
  const params: unknown[] = [];
  addFilter(where, params, "source_type", options.sourceType);
  addFilter(where, params, "source_id", options.sourceId);
  addFilter(where, params, "automation", options.automation);
  addFilter(where, params, "agent", options.agent);
  addFilter(where, params, "project", options.board);
  addFilter(where, params, "task_id", options.taskId);
  addFilter(where, params, "parent_run_id", options.parentRunId);
  addFilter(where, params, "root_run_id", options.rootRunId);

  const sql = `select * from runs${where.length ? ` where ${where.join(" and ")}` : ""} order by started_at desc limit ?`;
  const db = new Database(dbPath(), { readonly: true });
  try {
    return (db.prepare(sql).all(...params, limit) as RunRow[]).map(runToDto);
  } finally {
    db.close();
  }
}

export async function getRun(id: string): Promise<RunDto> {
  if (!existsSync(dbPath())) throw notFoundError(`Run not found: ${id}`);
  const db = new Database(dbPath(), { readonly: true });
  try {
    const row = db.prepare("select * from runs where id = ?").get(id) as RunRow | undefined;
    if (!row) throw notFoundError(`Run not found: ${id}`);
    return runToDto(row);
  } finally {
    db.close();
  }
}

function addFilter(where: string[], params: unknown[], column: string, value: string | undefined): void {
  if (!value) return;
  where.push(`${column} = ?`);
  params.push(value);
}

function runToDto(row: RunRow): RunDto {
  return {
    id: row.id,
    automation: row.automation,
    sourceType: row.source_type,
    sourceId: row.source_id,
    agent: row.agent,
    model: row.model,
    requestedModel: row.requested_model,
    resolvedModel: row.resolved_model,
    modelProfile: row.model_profile,
    modelResolutionWarning: row.model_resolution_warning,
    schedule: row.schedule,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationMs: row.duration_ms,
    exitCode: row.exit_code,
    signal: row.signal,
    outputText: row.output_text,
    traceText: row.trace_text,
    errorText: row.error_text,
    connectorActionsJson: row.connector_actions_json,
    parentRunId: row.parent_run_id,
    rootRunId: row.root_run_id,
    depth: row.depth,
    board: row.project,
    taskId: row.task_id,
    usage: parseUsage(row.usage_json),
  };
}

function parseUsage(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
