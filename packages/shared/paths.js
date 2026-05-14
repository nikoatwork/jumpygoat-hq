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

export function agenthqHome() {
  const configured = process.env.AGENTHQ_HOME?.trim();
  if (!configured) return path.join(repoRoot(), "workspace");
  return path.isAbsolute(configured) ? configured : path.resolve(repoRoot(), configured);
}

export function automationsDir() {
  return path.join(agenthqHome(), "automations");
}

export function agentsDir() {
  return path.join(agenthqHome(), "agents");
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
  return path.join(agenthqHome(), "data");
}

export function settingsDir() {
  return agenthqHome();
}

export function settingsPath() {
  return path.join(settingsDir(), "settings.yml");
}

export function workspacesDir() {
  return path.join(agenthqHome(), "workspaces");
}

export function workspaceDir(name) {
  return path.join(workspacesDir(), name);
}

export function tracesDir() {
  return path.join(agenthqHome(), "traces");
}

export function dbPath() {
  const configured = process.env.AGENTHQ_DB_PATH?.trim();
  if (!configured) return path.join(dataDir(), "agenthq.sqlite");
  return path.isAbsolute(configured) ? configured : path.join(agenthqHome(), configured);
}

export function automationPath(name) {
  return path.join(automationsDir(), `${name}.md`);
}

export function projectsDir() {
  return path.join(agenthqHome(), "projects");
}

export function projectDir(name) {
  return path.join(projectsDir(), name);
}

export function projectPath(name) {
  return path.join(projectDir(name), "PROJECT.md");
}

export function tasksDir(project) {
  return path.join(projectDir(project), "tasks");
}

export function taskPath(project, id) {
  return path.join(tasksDir(project), `${id}.md`);
}
