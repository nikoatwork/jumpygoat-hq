#!/usr/bin/env tsx
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadDotEnv } from "../packages/runner/src/env.js";
import { openDb, dbPath } from "../packages/runner/src/db.js";
import { agentsDir, automationsDir, boardsDir, dataDir, jumpyGoatHqHome, tracesDir, workdirsDir } from "../packages/shared/paths.js";

loadDotEnv();
seedWorkspaceSkeleton();

const db = openDb();
db.close();
console.log(`jumpyGoatHq workspace ready: ${jumpyGoatHqHome()}`);
console.log(`SQLite database ready: ${dbPath()}`);
console.log("Task heartbeat cron is explicit setup: run `pnpm install:task-cron` to dispatch ready assigned tasks periodically.");

function seedWorkspaceSkeleton(): void {
  for (const dir of [jumpyGoatHqHome(), agentsDir(), automationsDir(), boardsDir(), dataDir(), tracesDir(), workdirsDir()]) {
    mkdirSync(dir, { recursive: true });
  }
  writeIfMissing(path.join(boardsDir(), "README.md"), [
    "# boards",
    "",
    "Boards and one-off agent tasks live here.",
    "",
    "```text",
    "boards/<board>/BOARD.md",
    "boards/<board>/tasks/<task-id>.md",
    "```",
    "",
    "Move a task to `ready` and set `assignee: <agent-name>` for the task heartbeat dispatcher to pick it up.",
    "",
  ].join("\n"));
}

function writeIfMissing(file: string, content: string): void {
  if (existsSync(file)) return;
  writeFileSync(file, content, "utf8");
}
