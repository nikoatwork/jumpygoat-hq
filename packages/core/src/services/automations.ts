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
  agent?: string;
  schedule?: string;
  model?: string;
  prompt?: string;
  web?: unknown;
  notify?: unknown;
  mail?: unknown;
  scripts?: unknown;
  actors?: unknown;
  frontmatter?: Record<string, unknown>;
  rawMarkdown?: string;
};

export type AutomationUpdateInput = RevisionPrecondition & AutomationCreateInput;

type ResolvedAutomationInput = {
  name: string;
  agent: string;
  schedule: string;
  model?: string;
  prompt: string;
  frontmatter: Record<string, unknown>;
};

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
  const resolved = await resolveAutomationInput(input);
  await validateResolvedAutomationInput(resolved, "create");
  await writeAtomic(automationPath(resolved.name), automationMarkdown(resolved));
  return getAutomation(resolved.name, { includeRaw: true });
}

export async function updateAutomation(name: string, input: AutomationUpdateInput): Promise<AutomationDto> {
  assertAutomationName(name);
  if (input.name && name !== input.name) throw conflictError("Renaming automations is not supported. Create a new automation instead.");
  const existing = existsSync(automationPath(name)) ? await readAutomationFrontmatter(name) : undefined;
  const resolved = await resolveAutomationInput({ ...input, name: input.name || name }, existing);
  await validateResolvedAutomationInput(resolved, "update");
  await assertRevision(automationPath(name), input.ifMatch);
  await writeAtomic(automationPath(name), automationMarkdown(resolved));
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
      web: parsed.data.web,
      notify: parsed.data.notify,
      mail: parsed.data.mail,
      scripts: parsed.data.scripts,
      actors: parsed.data.actors,
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
  const existing = mode === "update" && isSafeName(input.name) && existsSync(automationPath(input.name)) ? await readAutomationFrontmatter(input.name) : undefined;
  const resolved = await resolveAutomationInput(input, existing);
  await validateResolvedAutomationInput(resolved, mode);
}

export function automationMarkdown(input: ResolvedAutomationInput | AutomationCreateInput): string {
  if ("frontmatter" in input && input.frontmatter && typeof input.agent === "string" && typeof input.schedule === "string") {
    return matter.stringify((input.prompt || "").trim() + "\n", input.frontmatter);
  }
  const createInput = input as AutomationCreateInput;
  const frontmatter = supportedAutomationFrontmatter({
    ...(isRecord(createInput.frontmatter) ? createInput.frontmatter : {}),
    agent: createInput.agent,
    schedule: createInput.schedule ?? "manual",
    model: createInput.model,
    web: createInput.web,
    notify: createInput.notify,
    mail: createInput.mail,
    scripts: createInput.scripts,
    actors: createInput.actors,
  });
  return matter.stringify((createInput.prompt || "").trim() + "\n", frontmatter);
}

async function readAutomationFrontmatter(name: string): Promise<{ data: Record<string, unknown>; prompt: string }> {
  const raw = await readFile(automationPath(name), "utf8");
  const parsed = matter(raw);
  return { data: parsed.data, prompt: parsed.content.trim() };
}

async function resolveAutomationInput(input: AutomationCreateInput, existing?: { data: Record<string, unknown>; prompt: string }): Promise<ResolvedAutomationInput> {
  let data: Record<string, unknown> = { ...(existing?.data || {}) };
  let prompt = input.prompt ?? existing?.prompt ?? "";

  if (typeof input.rawMarkdown === "string") {
    try {
      const parsed = matter(input.rawMarkdown);
      data = { ...parsed.data };
      prompt = parsed.content.trim();
    } catch (error) {
      throw validationError("Automation validation failed.", [{ field: "rawMarkdown", message: `Automation markdown/frontmatter could not be parsed: ${error instanceof Error ? error.message : String(error)}` }]);
    }
  }

  if (isRecord(input.frontmatter)) data = { ...data, ...input.frontmatter };
  if (input.agent !== undefined) data.agent = input.agent;
  if (input.schedule !== undefined) data.schedule = input.schedule || "manual";
  if (data.schedule === undefined) data.schedule = "manual";
  if (input.model !== undefined) {
    if (input.model) data.model = input.model;
    else delete data.model;
  }
  if (input.web !== undefined) data.web = input.web;
  if (input.notify !== undefined) data.notify = input.notify;
  if (input.mail !== undefined) data.mail = input.mail;
  if (input.scripts !== undefined) data.scripts = input.scripts;
  if (input.actors !== undefined) data.actors = input.actors;

  const frontmatter = supportedAutomationFrontmatter(data);
  return {
    name: input.name,
    agent: typeof frontmatter.agent === "string" ? frontmatter.agent : "",
    schedule: typeof frontmatter.schedule === "string" ? frontmatter.schedule : "",
    model: typeof frontmatter.model === "string" ? frontmatter.model : undefined,
    prompt,
    frontmatter,
  };
}

function supportedAutomationFrontmatter(data: Record<string, unknown>): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {
    agent: data.agent,
    schedule: data.schedule ?? "manual",
  };
  if (data.model !== undefined && data.model !== "") frontmatter.model = data.model;
  if (data.web !== undefined) frontmatter.web = data.web;
  if (data.notify !== undefined) frontmatter.notify = data.notify;
  if (data.mail !== undefined) frontmatter.mail = data.mail;
  if (data.scripts !== undefined) frontmatter.scripts = data.scripts;
  if (data.actors !== undefined) frontmatter.actors = data.actors;
  return frontmatter;
}

async function validateResolvedAutomationInput(input: ResolvedAutomationInput, mode: "create" | "update"): Promise<void> {
  const fields = [];
  if (!isSafeName(input.name)) fields.push({ field: "name", message: "Name must use lowercase letters, numbers, and hyphens only." });
  if (!input.agent) fields.push({ field: "agent", message: "Agent is required." });
  if (!input.prompt) fields.push({ field: "prompt", message: "Prompt is required." });
  if (!isValidSchedule(input.schedule)) fields.push({ field: "schedule", message: "Schedule must be 'manual' or a valid 5-field cron expression." });
  if ((input.model || "").length > 200) fields.push({ field: "model", message: "Model must be 200 characters or fewer." });
  if (input.frontmatter.model !== undefined && typeof input.frontmatter.model !== "string") fields.push({ field: "model", message: "Model must be a string." });
  if (input.frontmatter.web !== undefined && !isRecord(input.frontmatter.web)) fields.push({ field: "web", message: "Web connector config must be an object." });
  if (input.frontmatter.notify !== undefined && !isRecord(input.frontmatter.notify)) fields.push({ field: "notify", message: "Notify connector config must be an object." });
  if (input.frontmatter.mail !== undefined && !isRecord(input.frontmatter.mail)) fields.push({ field: "mail", message: "Mail connector config must be an object." });
  if (input.frontmatter.scripts !== undefined && !isRecord(input.frontmatter.scripts)) fields.push({ field: "scripts", message: "Scripts connector config must be an object." });
  if (input.frontmatter.actors !== undefined && !isRecord(input.frontmatter.actors)) fields.push({ field: "actors", message: "Actors connector config must be an object." });
  if (input.agent && !existsSync(agentPath(input.agent))) fields.push({ field: "agent", message: `Agent does not exist: ${input.agent}` });

  if (isSafeName(input.name)) {
    const exists = existsSync(automationPath(input.name));
    if (mode === "create" && exists) fields.push({ field: "name", message: `Automation already exists: ${input.name}` });
    if (mode === "update" && !exists) fields.push({ field: "name", message: `Automation does not exist: ${input.name}` });
  }

  if (fields.length) throw validationError("Automation validation failed.", fields);
}

function isValidSchedule(value: string): boolean {
  if (value === "manual") return true;
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  return parts.every((part) => /^[\d*,/\-]+$/.test(part));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
