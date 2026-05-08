import path from "node:path";
import { existsSync } from "node:fs";

export function repoRoot(): string {
  let dir = process.cwd();
  while (true) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml")) || existsSync(path.join(dir, "automations"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}

export function automationPath(name: string): string {
  return path.join(repoRoot(), "automations", `${name}.md`);
}

export function skillPath(skill: string): string {
  if (skill.includes("/") || skill.endsWith(".md")) return path.resolve(repoRoot(), skill);
  return path.join(repoRoot(), "skills", skill, "SKILL.md");
}

export function workspaceDir(name: string): string {
  return path.join(repoRoot(), "workspaces", name);
}

export function tracesDir(): string {
  return path.join(repoRoot(), "traces");
}
