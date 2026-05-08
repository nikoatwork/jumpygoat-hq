import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { automationsDir, repoRoot, skillsDir } from "./paths.js";
import { listAutomations, listSkills } from "./readers.js";

export type AutomationFormValues = {
  name: string;
  skill: string;
  schedule: string;
  model: string;
  prompt: string;
};

export type SkillFormValues = {
  name: string;
  content: string;
};

export type ValidationResult<T> = { ok: true; values: T } | { ok: false; values: T; errors: string[] };

const SAFE_NAME = /^[a-z0-9][a-z0-9-]*$/;

export function assertAutomationName(name: string): void {
  if (!SAFE_NAME.test(name)) throw new Error(`Invalid automation name: ${name}`);
}

export function assertSkillName(name: string): void {
  if (!SAFE_NAME.test(name)) throw new Error(`Invalid skill name: ${name}`);
}

export function automationPath(name: string): string {
  assertAutomationName(name);
  return path.join(automationsDir(), `${name}.md`);
}

export function skillPath(name: string): string {
  assertSkillName(name);
  return path.join(skillsDir(), name, "SKILL.md");
}

export function parseAutomationForm(form: URLSearchParams, fallbackName = ""): AutomationFormValues {
  return {
    name: String(form.get("name") || fallbackName).trim(),
    skill: String(form.get("skill") || "").trim(),
    schedule: String(form.get("schedule") || "manual").trim(),
    model: String(form.get("model") || "").trim(),
    prompt: String(form.get("prompt") || "").trim(),
  };
}

export function parseSkillForm(form: URLSearchParams, fallbackName = ""): SkillFormValues {
  return {
    name: String(form.get("name") || fallbackName).trim(),
    content: String(form.get("content") || ""),
  };
}

export async function validateAutomation(values: AutomationFormValues, mode: "create" | "update"): Promise<ValidationResult<AutomationFormValues>> {
  const errors: string[] = [];
  if (!SAFE_NAME.test(values.name)) errors.push("Name must use lowercase letters, numbers, and hyphens only.");
  if (!values.skill) errors.push("Skill is required.");
  if (!values.prompt) errors.push("Prompt is required.");
  if (!isValidSchedule(values.schedule)) errors.push("Schedule must be 'manual' or a valid 5-field cron expression.");
  if (values.model.length > 200) errors.push("Model must be 200 characters or fewer.");

  const skills = await listSkills();
  if (values.skill && !skills.some((skill) => skill.name === values.skill)) errors.push(`Skill does not exist: ${values.skill}`);

  if (SAFE_NAME.test(values.name)) {
    const exists = existsSync(automationPath(values.name));
    if (mode === "create" && exists) errors.push(`Automation already exists: ${values.name}`);
    if (mode === "update" && !exists) errors.push(`Automation does not exist: ${values.name}`);
  }

  return errors.length ? { ok: false, values, errors } : { ok: true, values };
}

export function validateSkill(values: SkillFormValues, mode: "create" | "update"): ValidationResult<SkillFormValues> {
  const errors: string[] = [];
  if (!SAFE_NAME.test(values.name)) errors.push("Name must use lowercase letters, numbers, and hyphens only.");
  if (!values.content.trim()) errors.push("Skill content is required.");
  if (values.content.trim()) {
    try {
      matter(values.content);
    } catch (error) {
      errors.push(`Skill markdown/frontmatter could not be parsed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (SAFE_NAME.test(values.name)) {
    const exists = existsSync(skillPath(values.name));
    if (mode === "create" && exists) errors.push(`Skill already exists: ${values.name}`);
    if (mode === "update" && !exists) errors.push(`Skill does not exist: ${values.name}`);
  }
  return errors.length ? { ok: false, values, errors } : { ok: true, values };
}

export async function createAutomation(values: AutomationFormValues): Promise<void> {
  await writeAtomic(automationPath(values.name), automationMarkdown(values));
}

export async function updateAutomation(name: string, values: AutomationFormValues): Promise<void> {
  assertAutomationName(name);
  if (name !== values.name) throw new Error("Renaming automations is not supported. Create a new automation instead.");
  await writeAtomic(automationPath(name), automationMarkdown(values));
}

export async function deleteAutomation(name: string): Promise<void> {
  assertAutomationName(name);
  await rm(automationPath(name), { force: false });
}

export async function createSkill(values: SkillFormValues): Promise<void> {
  await writeAtomic(skillPath(values.name), values.content.trimEnd() + "\n");
}

export async function updateSkill(name: string, values: SkillFormValues): Promise<void> {
  assertSkillName(name);
  if (name !== values.name) throw new Error("Renaming skills is not supported. Create a new skill instead.");
  await writeAtomic(skillPath(name), values.content.trimEnd() + "\n");
}

export async function deleteSkill(name: string): Promise<void> {
  assertSkillName(name);
  const automations = await listAutomations();
  const users = automations.filter((automation) => automation.skill === name).map((automation) => automation.name);
  if (users.length) throw new Error(`Cannot delete skill ${name}; used by automation(s): ${users.join(", ")}`);
  await rm(path.join(skillsDir(), name), { recursive: true, force: false });
}

export async function readAutomationRaw(name: string): Promise<AutomationFormValues> {
  assertAutomationName(name);
  const raw = await readFile(automationPath(name), "utf8");
  const parsed = matter(raw);
  return {
    name,
    skill: String(parsed.data.skill || ""),
    schedule: String(parsed.data.schedule || "manual"),
    model: parsed.data.model ? String(parsed.data.model) : "",
    prompt: parsed.content.trim(),
  };
}

export async function readSkillRaw(name: string): Promise<SkillFormValues> {
  assertSkillName(name);
  return { name, content: await readFile(skillPath(name), "utf8") };
}

export function defaultSkillContent(name: string): string {
  return `---\nname: ${name || "new-skill"}\ndescription: Describe when to use this skill.\n---\n\n## Overview\n\nDescribe what this skill does and how Pi should use it.\n`;
}

export async function runNow(name: string): Promise<{ stdout: string; stderr: string }> {
  assertAutomationName(name);
  return await new Promise((resolve, reject) => {
    execFile("pnpm", ["runner", name], { cwd: repoRoot(), env: process.env, timeout: 1000 * 60 * 30 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Run failed: ${error.message}\n\nstdout:\n${stdout}\n\nstderr:\n${stderr}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function automationMarkdown(values: AutomationFormValues): string {
  const lines = ["---", `skill: ${JSON.stringify(values.skill)}`, `schedule: ${JSON.stringify(values.schedule || "manual")}`];
  if (values.model) lines.push(`model: ${JSON.stringify(values.model)}`);
  lines.push("---", "", values.prompt.trim(), "");
  return lines.join("\n");
}

function isValidSchedule(value: string): boolean {
  if (value === "manual") return true;
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  return parts.every((part) => /^[\d*,/\-]+$/.test(part));
}

async function writeAtomic(file: string, content: string): Promise<void> {
  const dir = path.dirname(file);
  await mkdir(dir, { recursive: true });
  const temp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  await writeFile(temp, content, "utf8");
  await rename(temp, file);
}
