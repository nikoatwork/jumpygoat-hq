import path from "node:path";
import { existsSync } from "node:fs";

export function repoRoot(): string {
  let dir = process.cwd();
  while (true) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml")) || existsSync(path.join(dir, "automations"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}

export function dbPath(): string {
  const configured = process.env.AGENTHQ_DB_PATH;
  if (!configured) return path.join(repoRoot(), "data", "agenthq.sqlite");
  return path.isAbsolute(configured) ? configured : path.join(repoRoot(), configured);
}

export function automationsDir(): string {
  return path.join(repoRoot(), "automations");
}

export function skillsDir(): string {
  return path.join(repoRoot(), "skills");
}
