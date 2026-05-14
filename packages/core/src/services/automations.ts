import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, rm } from "node:fs/promises";
import matter from "gray-matter";
import { agentPath, automationPath, automationsDir, repoRoot } from "../../../shared/paths.js";
import type { AutomationDto, ListOptions, RevisionPrecondition } from "../dto.js";
import { conflictError, notFoundError, validationError } from "../errors.js";
import { assertRevision, fileMeta, writeAtomic } from "../files.js";
import { assertAutomationName, isSafeName } from "../names.js";

export type AutomationCreateInput = {
  name: string;
  agent: string;
  schedule: string;
  model?: string;
  prompt: string;
};

export type AutomationUpdateInput = RevisionPrecondition & AutomationCreateInput;

export type RunAutomationInput = {
  wait?: boolean;
};

export type RunAutomationResult = {
  stdout: string;
  stderr: string;
};

export interface AutomationService {
  list(options?: ListOptions): Promise<AutomationDto[]>;
  get(name: string, options?: ListOptions): Promise<AutomationDto>;
  create(input: AutomationCreateInput): Promise<AutomationDto>;
  update(name: string, input: AutomationUpdateInput): Promise<AutomationDto>;
  delete(name: string): Promise<void>;
  runNow(name: string, input?: RunAutomationInput): Promise<RunAutomationResult>;
}

export async function listAutomations(options: ListOptions = {}): Promise<AutomationDto[]> {
  if (!existsSync(automationsDir())) return [];
  const files = (await readdir(automationsDir())).filter((file) => file.endsWith(".md") && file !== "README.md").sort();
  return Promise.all(files.map((file) => readAutomationFile(file.replace(/\.md$/, ""), options)));
}

export async function getAutomation(name: string, options: ListOptions = {}): Promise<AutomationDto> {
  assertAutomationName(name);
  if (!existsSync(automationPath(name))) throw notFoundError(`Automation not found: ${name}`);
  return readAutomationFile(name, options);
}

export async function createAutomation(input: AutomationCreateInput): Promise<AutomationDto> {
  await validateAutomationInput(input, "create");
  await writeAtomic(automationPath(input.name), automationMarkdown(input));
  return getAutomation(input.name, { includeRaw: true });
}

export async function updateAutomation(name: string, input: AutomationUpdateInput): Promise<AutomationDto> {
  assertAutomationName(name);
  if (name !== input.name) throw conflictError("Renaming automations is not supported. Create a new automation instead.");
  await validateAutomationInput(input, "update");
  await assertRevision(automationPath(name), input.ifMatch);
  await writeAtomic(automationPath(name), automationMarkdown(input));
  return getAutomation(name, { includeRaw: true });
}

export async function deleteAutomation(name: string): Promise<void> {
  assertAutomationName(name);
  if (!existsSync(automationPath(name))) throw notFoundError(`Automation not found: ${name}`);
  await rm(automationPath(name), { force: false });
}

export async function runAutomationNow(name: string): Promise<RunAutomationResult> {
  assertAutomationName(name);
  if (!existsSync(automationPath(name))) throw notFoundError(`Automation not found: ${name}`);
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

async function readAutomationFile(name: string, options: ListOptions): Promise<AutomationDto> {
  const file = automationPath(name);
  try {
    const raw = await readFile(file, "utf8");
    const parsed = matter(raw);
    return {
      name,
      agent: String(parsed.data.agent || ""),
      schedule: String(parsed.data.schedule || "manual"),
      model: parsed.data.model ? String(parsed.data.model) : "",
      prompt: parsed.content.trim(),
      promptPreview: parsed.content.trim().replace(/\s+/g, " ").slice(0, 160),
      ...(options.includeRaw ? { rawMarkdown: raw } : {}),
      ...(await fileMeta(file)),
    };
  } catch (error) {
    return {
      name,
      agent: "",
      schedule: "",
      model: "",
      prompt: "",
      promptPreview: "",
      warning: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function validateAutomationInput(input: AutomationCreateInput, mode: "create" | "update"): Promise<void> {
  const fields = [];
  if (!isSafeName(input.name)) fields.push({ field: "name", message: "Name must use lowercase letters, numbers, and hyphens only." });
  if (!input.agent) fields.push({ field: "agent", message: "Agent is required." });
  if (!input.prompt) fields.push({ field: "prompt", message: "Prompt is required." });
  if (!isValidSchedule(input.schedule)) fields.push({ field: "schedule", message: "Schedule must be 'manual' or a valid 5-field cron expression." });
  if ((input.model || "").length > 200) fields.push({ field: "model", message: "Model must be 200 characters or fewer." });
  if (input.agent && !existsSync(agentPath(input.agent))) fields.push({ field: "agent", message: `Agent does not exist: ${input.agent}` });

  if (isSafeName(input.name)) {
    const exists = existsSync(automationPath(input.name));
    if (mode === "create" && exists) fields.push({ field: "name", message: `Automation already exists: ${input.name}` });
    if (mode === "update" && !exists) fields.push({ field: "name", message: `Automation does not exist: ${input.name}` });
  }

  if (fields.length) throw validationError("Automation validation failed.", fields);
}

export function automationMarkdown(input: AutomationCreateInput): string {
  const lines = ["---", `agent: ${JSON.stringify(input.agent)}`, `schedule: ${JSON.stringify(input.schedule || "manual")}`];
  if (input.model) lines.push(`model: ${JSON.stringify(input.model)}`);
  lines.push("---", "", input.prompt.trim(), "");
  return lines.join("\n");
}

function isValidSchedule(value: string): boolean {
  if (value === "manual") return true;
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  return parts.every((part) => /^[\d*,/\-]+$/.test(part));
}
