import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import matter from "gray-matter";
import { automationsDir, dbPath, skillsDir } from "./paths.js";

export type AutomationView = {
  name: string;
  skill: string;
  schedule: string;
  model: string;
  promptPreview: string;
  warning?: string;
};

export type SkillView = {
  name: string;
  description: string;
  path: string;
  warning?: string;
};

export type CronBlock = {
  name: string;
  block: string;
  line: string;
};

export type RunRow = {
  id: string;
  automation: string;
  skill: string;
  model: string | null;
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
  connector_actions_json?: string;
};

export async function listAutomations(): Promise<AutomationView[]> {
  if (!existsSync(automationsDir())) return [];
  const files = (await readdir(automationsDir())).filter((f) => f.endsWith(".md") && f !== "README.md").sort();
  return Promise.all(files.map(readAutomationFile));
}

async function readAutomationFile(file: string): Promise<AutomationView> {
  const name = file.replace(/\.md$/, "");
  try {
    const raw = await readFile(path.join(automationsDir(), file), "utf8");
    const parsed = matter(raw);
    return {
      name,
      skill: String(parsed.data.skill || ""),
      schedule: String(parsed.data.schedule || "manual"),
      model: parsed.data.model ? String(parsed.data.model) : "",
      promptPreview: parsed.content.trim().replace(/\s+/g, " ").slice(0, 160),
    };
  } catch (error) {
    return { name, skill: "", schedule: "", model: "", promptPreview: "", warning: String(error) };
  }
}

export async function listSkills(): Promise<SkillView[]> {
  if (!existsSync(skillsDir())) return [];
  const entries = await readdir(skillsDir());
  const skills: SkillView[] = [];
  for (const entry of entries.sort()) {
    const skillFile = path.join(skillsDir(), entry, "SKILL.md");
    try {
      if (!existsSync(skillFile) || !(await stat(skillFile)).isFile()) continue;
      const raw = await readFile(skillFile, "utf8");
      const parsed = matter(raw);
      skills.push({
        name: String(parsed.data.name || entry),
        description: String(parsed.data.description || ""),
        path: skillFile,
      });
    } catch (error) {
      skills.push({ name: entry, description: "", path: skillFile, warning: String(error) });
    }
  }
  return skills;
}

export function listInstalledCronBlocks(): CronBlock[] {
  let text = "";
  try {
    text = execFileSync("crontab", ["-l"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    return [];
  }

  const lines = text.split("\n");
  const blocks: CronBlock[] = [];
  let current: { name: string; lines: string[] } | undefined;

  for (const line of lines) {
    const start = line.match(/^# agenthq:start ([a-z0-9-]+)$/);
    if (start) {
      current = { name: start[1]!, lines: [line] };
      continue;
    }
    if (current) {
      current.lines.push(line);
      if (line === `# agenthq:end ${current.name}`) {
        blocks.push({
          name: current.name,
          block: current.lines.join("\n"),
          line: current.lines.find((l) => l && !l.startsWith("#")) || "",
        });
        current = undefined;
      }
    }
  }
  return blocks;
}

export function listRuns(limit = 50): RunRow[] {
  if (!existsSync(dbPath())) return [];
  const db = new Database(dbPath(), { readonly: true });
  try {
    return db.prepare("select * from runs order by started_at desc limit ?").all(limit) as RunRow[];
  } finally {
    db.close();
  }
}

export function getRun(id: string): RunRow | null {
  if (!existsSync(dbPath())) return null;
  const db = new Database(dbPath(), { readonly: true });
  try {
    return (db.prepare("select * from runs where id = ?").get(id) as RunRow | undefined) || null;
  } finally {
    db.close();
  }
}
