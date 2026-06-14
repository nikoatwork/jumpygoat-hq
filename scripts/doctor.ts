#!/usr/bin/env tsx
import { loadDotEnv } from "../packages/runner/src/env.js";

loadDotEnv();
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { dbPath, setupDb } from "../packages/runner/src/db.js";
import { jumpyGoatHqHome, agentsDir, automationsDir, dataDir, repoRoot, tracesDir, workdirsDir } from "../packages/shared/paths.js";

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
ok(`workdirs dir: ${workdirsDir()}`);
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

checkOptionalConnectors();

console.log();
if (failed) {
  console.log("Doctor failed.");
  process.exitCode = 1;
} else {
  console.log("Doctor passed with possible warnings.");
}

function checkOptionalConnectors(): void {
  console.log("\nOptional connectors");

  if (process.env.FIRECRAWL_API_KEY) ok("Firecrawl configured: FIRECRAWL_API_KEY is set");
  else ok("Firecrawl not configured; optional unless an enabled automation uses web.search/web.scrape/web.crawl");

  const resendConfigured = Boolean(process.env.RESEND_API_KEY || process.env.JUMPYGOATHQ_NOTIFY_EMAIL_TO || process.env.JUMPYGOATHQ_NOTIFY_EMAIL_FROM || process.env.JUMPYGOATHQ_NOTIFY_SUBJECT_PREFIX);
  if (!resendConfigured) {
    ok("Resend not configured; optional unless an enabled automation uses notify.email");
  } else if (!process.env.RESEND_API_KEY) {
    warn("Resend partially configured: set RESEND_API_KEY before using notify.email");
  } else {
    ok("Resend configured: RESEND_API_KEY is set");
    if (!process.env.JUMPYGOATHQ_NOTIFY_EMAIL_FROM) warn("Resend has no JUMPYGOATHQ_NOTIFY_EMAIL_FROM default; provide notify.email.from in automation/agent config or env before sending");
    if (!process.env.JUMPYGOATHQ_NOTIFY_EMAIL_TO) warn("Resend has no JUMPYGOATHQ_NOTIFY_EMAIL_TO default; provide notify.email.to in automation/agent config or env before sending");
  }

  if (commandExists("tsx")) ok("local-script runner available: tsx found on PATH");
  else warn("local-script runner not found on PATH; install dependencies before using script.run");

  const agentMailConfigured = Boolean(process.env.AGENTMAIL_API_KEY || process.env.AGENTMAIL_INBOX_ID || process.env.AGENTMAIL_TO || process.env.AGENTMAIL_SUBJECT_PREFIX);
  if (!agentMailConfigured) {
    ok("AgentMail not configured; optional unless an enabled automation uses mail.send/mail.list");
  } else if (!process.env.AGENTMAIL_API_KEY) {
    warn("AgentMail partially configured: set AGENTMAIL_API_KEY before using mail.send/mail.list");
  } else {
    ok("AgentMail configured: AGENTMAIL_API_KEY is set");
    if (process.env.AGENTMAIL_INBOX_ID) ok(`AgentMail default inbox: ${process.env.AGENTMAIL_INBOX_ID}`);
    else warn("AgentMail has no AGENTMAIL_INBOX_ID default; provide mail.send.inboxId/mail.list.inboxId in automation/agent config or env before use");
  }

  const r2Fields = ["CLOUDFLARE_R2_ACCOUNT_ID", "CLOUDFLARE_R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_SECRET_ACCESS_KEY", "CLOUDFLARE_R2_BUCKET"];
  const r2Present = r2Fields.filter((name) => Boolean(process.env[name]));
  if (r2Present.length === 0) {
    ok("Cloudflare R2 artifacts not configured; optional unless an enabled automation uses artifact.upload");
  } else if (r2Present.length < r2Fields.length) {
    warn(`Cloudflare R2 artifacts partially configured: missing ${r2Fields.filter((name) => !process.env[name]).join(", ")}`);
  } else {
    ok("Cloudflare R2 artifacts configured for artifact.upload");
    ok(`Cloudflare R2 bucket: ${process.env.CLOUDFLARE_R2_BUCKET}`);
  }
}
