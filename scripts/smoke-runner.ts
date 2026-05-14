#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { agenthqHome, agentsDir, automationsDir, dbPath, repoRoot } from "../packages/shared/paths.js";

const explicitAutomation = Boolean(process.env.AGENTHQ_SMOKE_AUTOMATION || process.argv[2]);
const automation = process.env.AGENTHQ_SMOKE_AUTOMATION || process.argv[2] || "agenthq-smoke";
const dbFile = dbPath();
const startedAt = new Date().toISOString();
const cleanupPaths: string[] = [];
const cleanupDirs: string[] = [];

function section(title: string): void {
  console.log(`\n== ${title} ==`);
}

function tail(text: string, max = 4_000): string {
  if (!text) return "";
  return text.length > max ? `...<truncated>\n${text.slice(-max)}` : text;
}

function run(command: string, args: string[]): { status: number; stdout: string; stderr: string } {
  section(`$ ${[command, ...args].join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: repoRoot(),
    encoding: "utf8",
    env: process.env,
  });
  const status = result.status ?? 1;
  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  if (stdout.trim()) console.log(tail(stdout));
  if (stderr.trim()) console.error(tail(stderr));
  console.log(`exit: ${status}`);
  return { status, stdout, stderr };
}

function latestRun(): Record<string, unknown> | undefined {
  const db = new Database(dbFile, { readonly: true });
  try {
    return db.prepare(`
      select * from runs
      where automation = ? and started_at >= ?
      order by started_at desc
      limit 1
    `).get(automation, startedAt) as Record<string, unknown> | undefined;
  } finally {
    db.close();
  }
}

function ensureDefaultSmokeFixture(): void {
  if (explicitAutomation) return;

  const automationFile = path.join(automationsDir(), `${automation}.md`);
  const agentDir = path.join(agentsDir(), automation);
  const agentFile = path.join(agentDir, "AGENT.md");

  if (!existsSync(agentFile)) {
    if (!existsSync(agentDir)) cleanupDirs.push(agentDir);
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(agentFile, `---\nname: ${automation}\ndescription: Temporary local backend validation agent.\nallowedIntents: []\n---\n\n# Backend Smoke\n\nReply with one concise sentence confirming the smoke run executed. Do not inspect files, run shell commands, run validation, or perform any other actions.\n`, "utf8");
    cleanupPaths.push(agentFile);
  }

  if (!existsSync(automationFile)) {
    mkdirSync(path.dirname(automationFile), { recursive: true });
    writeFileSync(automationFile, `---\nagent: "${automation}"\nschedule: "manual"\n---\n\nRun the backend smoke check by replying with one concise sentence only. Do not use tools or run commands.\n`, "utf8");
    cleanupPaths.push(automationFile);
  }

  if (cleanupPaths.length) {
    section("local smoke fixture");
    console.log(`created temporary gitignored agent/automation fixture for ${automation}`);
  }
}

function cleanupDefaultSmokeFixture(): void {
  for (const cleanupPath of cleanupPaths) {
    try {
      rmSync(cleanupPath, { recursive: true, force: true });
    } catch (error) {
      console.error(`warning: failed to remove temporary fixture ${cleanupPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  for (const cleanupDir of cleanupDirs.reverse()) {
    try {
      rmSync(cleanupDir, { force: true });
    } catch {
      // Leave non-empty pre-existing parent structure alone.
    }
  }
}

let failed = false;

section("agenthq backend smoke");
console.log(`automation: ${automation}`);
console.log(`workspace: ${agenthqHome()}`);
console.log(`db: ${dbFile}`);
console.log(`started_after: ${startedAt}`);
ensureDefaultSmokeFixture();

const setup = run("pnpm", ["setup:db"]);
if (setup.status !== 0) failed = true;

const runner = failed ? { status: 1, stdout: "", stderr: "skipped because setup failed" } : run("pnpm", ["runner", automation]);
if (runner.status !== 0) failed = true;

let row: Record<string, unknown> | undefined;
if (!failed || runner.status !== 0) {
  try {
    row = latestRun();
  } catch (error) {
    console.error(`failed to query smoke run row: ${error instanceof Error ? error.message : String(error)}`);
    failed = true;
  }
}

section("smoke result");
if (!row) {
  console.error(`FAIL: no runs row found for ${automation} after ${startedAt}`);
  failed = true;
} else {
  const output = String(row.output_text || "");
  const trace = String(row.trace_text || "");
  const error = String(row.error_text || "");
  console.log(`run_id: ${row.id}`);
  console.log(`status: ${row.status}`);
  console.log(`exit_code: ${row.exit_code}`);
  console.log(`duration_ms: ${row.duration_ms}`);
  console.log(`output_chars: ${output.length}`);
  console.log(`trace_chars: ${trace.length}`);
  console.log(`error_chars: ${error.length}`);
  console.log(`connector_actions_json: ${String(row.connector_actions_json || "[]")}`);

  if (row.status !== "ok" || row.exit_code !== 0) {
    console.error("FAIL: run status or exit_code is not ok/0");
    failed = true;
  }
  if (!output.trim() && !trace.trim()) {
    console.error("FAIL: run produced neither output_text nor trace_text");
    failed = true;
  }

  if (output.trim()) {
    section("output tail");
    console.log(tail(output));
  }
  if (error.trim()) {
    section("error tail");
    console.error(tail(error));
  }
  if (trace.trim()) {
    section("trace tail");
    console.log(tail(trace));
  }
}

cleanupDefaultSmokeFixture();

if (failed) {
  section("validation failed");
  console.error("Backend smoke failed. Inspect stdout/stderr and trace tail above before changing code.");
  process.exit(1);
}

section("validation passed");
console.log("Backend smoke passed: one automation ran through Pi and wrote an inspectable runs row.");
