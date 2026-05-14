import { existsSync } from "node:fs";
import { readdir, readFile, rm, stat } from "node:fs/promises";
import matter from "gray-matter";
import { agentContextDir, agentDir, agentPath, agentsDir } from "../../../shared/paths.js";
import type { AgentDto, ListOptions, RevisionPrecondition } from "../dto.js";
import { conflictError, notFoundError, validationError } from "../errors.js";
import { assertRevision, fileMeta, writeAtomic } from "../files.js";
import { assertAgentName, isSafeName } from "../names.js";
import { listAutomations } from "./automations.js";

export type AgentCreateInput = {
  name: string;
  content: string;
};

export type AgentUpdateInput = RevisionPrecondition & {
  name: string;
  content: string;
};

export interface AgentService {
  list(options?: ListOptions): Promise<AgentDto[]>;
  get(name: string, options?: ListOptions): Promise<AgentDto>;
  create(input: AgentCreateInput): Promise<AgentDto>;
  update(name: string, input: AgentUpdateInput): Promise<AgentDto>;
  delete(name: string): Promise<void>;
}

export async function listAgents(options: ListOptions = {}): Promise<AgentDto[]> {
  if (!existsSync(agentsDir())) return [];
  const entries = await readdir(agentsDir());
  const agents: AgentDto[] = [];
  for (const entry of entries.sort()) {
    const file = agentPath(entry);
    try {
      if (!existsSync(file) || !(await stat(file)).isFile()) continue;
      agents.push(await readAgentFile(entry, options));
    } catch (error) {
      agents.push({ name: entry, description: "", contextCount: 0, warning: error instanceof Error ? error.message : String(error), path: file });
    }
  }
  return agents;
}

export async function getAgent(name: string, options: ListOptions = {}): Promise<AgentDto> {
  assertAgentName(name);
  if (!existsSync(agentPath(name))) throw notFoundError(`Agent not found: ${name}`);
  return readAgentFile(name, options);
}

export async function createAgent(input: AgentCreateInput): Promise<AgentDto> {
  validateAgentInput(input, "create");
  await writeAtomic(agentPath(input.name), input.content.trimEnd() + "\n");
  return getAgent(input.name, { includeRaw: true });
}

export async function updateAgent(name: string, input: AgentUpdateInput): Promise<AgentDto> {
  assertAgentName(name);
  if (name !== input.name) throw conflictError("Renaming agents is not supported. Create a new agent instead.");
  validateAgentInput(input, "update");
  await assertRevision(agentPath(name), input.ifMatch);
  await writeAtomic(agentPath(name), input.content.trimEnd() + "\n");
  return getAgent(name, { includeRaw: true });
}

export async function deleteAgent(name: string): Promise<void> {
  assertAgentName(name);
  if (!existsSync(agentPath(name))) throw notFoundError(`Agent not found: ${name}`);
  const automations = await listAutomations();
  const users = automations.filter((automation) => automation.agent === name).map((automation) => automation.name);
  if (users.length) throw conflictError(`Cannot delete agent ${name}; used by automation(s): ${users.join(", ")}`);
  await rm(agentDir(name), { recursive: true, force: false });
}

export function defaultAgentContent(name: string): string {
  return `---\nname: ${name || "new-agent"}\ndescription: Describe this agent's operational role.\nallowedIntents: []\n---\n\n## Identity\n\nDescribe who this agent is responsible for being and what outcomes it owns.\n\n## Operating policy\n\nDescribe how the agent should decide, what context it should trust, and what it must not do.\n\n## Connector policy\n\nExternal services and side effects must use jumpyGoatHq connectors enabled by allowedIntents plus invocation config. Do not put secrets in this file.\n\n## Output expectations\n\nDescribe the final response format for automations and assigned tasks.\n`;
}

async function readAgentFile(name: string, options: ListOptions): Promise<AgentDto> {
  const file = agentPath(name);
  const raw = await readFile(file, "utf8");
  const parsed = matter(raw);
  return {
    name: String(parsed.data.name || name),
    description: String(parsed.data.description || ""),
    contextCount: await countContextFiles(name),
    ...(options.includeRaw ? { rawMarkdown: raw } : {}),
    ...(await fileMeta(file)),
  };
}

async function countContextFiles(agent: string): Promise<number> {
  const dir = agentContextDir(agent);
  if (!existsSync(dir)) return 0;
  return (await readdir(dir)).filter((file) => file.endsWith(".md")).length;
}

export function validateAgentInput(input: AgentCreateInput, mode: "create" | "update"): void {
  const fields = [];
  if (!isSafeName(input.name)) fields.push({ field: "name", message: "Name must use lowercase letters, numbers, and hyphens only." });
  if (!input.content.trim()) fields.push({ field: "content", message: "Agent content is required." });
  if (input.content.trim()) {
    try {
      matter(input.content);
    } catch (error) {
      fields.push({ field: "content", message: `Agent markdown/frontmatter could not be parsed: ${error instanceof Error ? error.message : String(error)}` });
    }
  }
  if (isSafeName(input.name)) {
    const exists = existsSync(agentPath(input.name));
    if (mode === "create" && exists) fields.push({ field: "name", message: `Agent already exists: ${input.name}` });
    if (mode === "update" && !exists) fields.push({ field: "name", message: `Agent does not exist: ${input.name}` });
  }
  if (fields.length) throw validationError("Agent validation failed.", fields);
}
