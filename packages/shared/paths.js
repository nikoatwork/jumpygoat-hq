import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sharedDir = path.dirname(fileURLToPath(import.meta.url));
const fallbackRepoRoot = path.resolve(sharedDir, "../..");

export function repoRoot() {
  let dir = process.cwd();
  while (true) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return fallbackRepoRoot;
    dir = parent;
  }
}

export function jumpyGoatHqHome() {
  const configured = process.env.JUMPYGOATHQ_HOME?.trim();
  if (!configured) return path.join(repoRoot(), "workspace");
  return path.isAbsolute(configured) ? configured : path.resolve(repoRoot(), configured);
}

export function automationsDir() {
  return path.join(jumpyGoatHqHome(), "automations");
}

export function agentsDir() {
  return path.join(jumpyGoatHqHome(), "agents");
}

export function agentDir(name) {
  return path.join(agentsDir(), name);
}

export function agentPath(name) {
  return path.join(agentDir(name), "AGENT.md");
}

export function agentContextDir(name) {
  return path.join(agentDir(name), "context");
}

export function dataDir() {
  return path.join(jumpyGoatHqHome(), "data");
}

export function settingsDir() {
  return jumpyGoatHqHome();
}

export function settingsPath() {
  return path.join(settingsDir(), "settings.yml");
}

export function workspacesDir() {
  return path.join(jumpyGoatHqHome(), "workspaces");
}

export function workspaceDir(name) {
  return path.join(workspacesDir(), name);
}

export function tracesDir() {
  return path.join(jumpyGoatHqHome(), "traces");
}

export function dbPath() {
  const configured = process.env.JUMPYGOATHQ_DB_PATH?.trim();
  if (!configured) return path.join(dataDir(), "jumpygoat-hq.sqlite");
  return path.isAbsolute(configured) ? configured : path.join(jumpyGoatHqHome(), configured);
}

export function automationPath(name) {
  return path.join(automationsDir(), `${name}.md`);
}

export function boardsDir() {
  return path.join(jumpyGoatHqHome(), "boards");
}

export function boardDir(name) {
  return path.join(boardsDir(), name);
}

export function boardPath(name) {
  return path.join(boardDir(name), "BOARD.md");
}

export function tasksDir(board) {
  return path.join(boardDir(board), "tasks");
}

export function taskPath(board, id) {
  return path.join(tasksDir(board), `${id}.md`);
}

// Legacy aliases kept only so older internal imports fail softly during the pre-release rename.
export const projectsDir = boardsDir;
export const projectDir = boardDir;
export const projectPath = boardPath;
