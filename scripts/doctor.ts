#!/usr/bin/env tsx
import { loadDotEnv } from "../packages/runner/src/env.js";

loadDotEnv();
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { dbPath, setupDb } from "../packages/runner/src/db.js";
import { jumpyGoatHqHome, agentsDir, automationsDir, dataDir, repoRoot, tracesDir, workspacesDir } from "../packages/shared/paths.js";

let failed = false;

function ok(message: string): void {
  console.log(`✓ ${message}`);
}

function warn(message: string): void {
  console.log(`! ${message}`);
}

function fail(message: string): void {
  failed = true;
  console.log(`✗ ${message}`);
}

function commandExists(command: string): boolean {
  const result = spawnSync("/bin/sh", ["-lc", `command -v ${command}`], { encoding: "utf8" });
  return result.status === 0;
}

console.log("jumpyGoatHq doctor\n");

ok(`repo root: ${repoRoot()}`);
ok(`workspace root: ${jumpyGoatHqHome()}`);
ok(`automations dir: ${automationsDir()}`);
ok(`agents dir: ${agentsDir()}`);
ok(`data dir: ${dataDir()}`);
ok(`workspaces dir: ${workspacesDir()}`);
ok(`traces dir: ${tracesDir()}`);
ok(`user: ${os.userInfo().username}`);
ok(`HOME: ${os.homedir()}`);

if (commandExists("node")) ok(`node: ${execFileSync("node", ["-v"], { encoding: "utf8" }).trim()}`);
else fail("node not found on PATH");

if (commandExists("pnpm")) ok(`pnpm: ${execFileSync("pnpm", ["-v"], { encoding: "utf8" }).trim()}`);
else fail("pnpm not found on PATH");

if (commandExists("pi")) ok(`pi: ${execFileSync("/bin/sh", ["-lc", "command -v pi"], { encoding: "utf8" }).trim()}`);
else fail("pi not found on PATH");

if (commandExists("crontab")) ok("crontab available");
else warn("crontab not found; cron install scripts will not work on this machine");

const authPath = process.env.PI_CODING_AGENT_DIR
  ? path.join(process.env.PI_CODING_AGENT_DIR, "auth.json")
  : path.join(os.homedir(), ".pi", "agent", "auth.json");

if (existsSync(authPath)) ok(`Pi auth file exists: ${authPath}`);
else warn(`Pi auth file not found at ${authPath}. Run 'pi /login' as this same user, or provide provider env vars.`);

try {
  const db = new Database(":memory:");
  setupDb(db);
  db.prepare("select count(*) as count from runs").get();
  db.close();
  ok(`SQLite driver ready; local DB path on first run: ${dbPath()}`);
} catch (error) {
  fail(`SQLite setup failed: ${error instanceof Error ? error.message : String(error)}`);
}

if (process.env.VERCEL_AI_GATEWAY_API_KEY) ok("VERCEL_AI_GATEWAY_API_KEY is set");
else warn("VERCEL_AI_GATEWAY_API_KEY not set; okay if Pi stored login/provider auth is configured");

console.log();
if (failed) {
  console.log("Doctor failed.");
  process.exitCode = 1;
} else {
  console.log("Doctor passed with possible warnings.");
}
