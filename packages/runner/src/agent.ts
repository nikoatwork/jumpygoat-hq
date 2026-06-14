import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import { agentContextDir, agentPath } from "./paths.js";
import { ConnectorOverridesSchema, type ConnectorOverrides } from "./automation.js";

const AgentFrontmatter = ConnectorOverridesSchema.extend({
  name: z.string().optional(),
  description: z.string().optional(),
  model: z.string().optional(),
  allowedIntents: z.array(z.string()).optional(),
});

export type AgentMeta = ConnectorOverrides & {
  name: string;
  description?: string;
  model?: string;
  allowedIntents: string[];
  path?: string;
};

export type AgentContextFile = {
  name: string;
  path: string;
  content: string;
};

export type Agent = AgentMeta & {
  path: string;
  raw: string;
  contextFiles: AgentContextFile[];
  instructions: string;
};

export async function loadAgent(name: string): Promise<Agent> {
  const file = agentPath(name);
  const raw = await readFile(file, "utf8");
  const parsed = matter(raw);
  const frontmatter = AgentFrontmatter.parse(parsed.data);
  const contextFiles = await loadAgentContext(name);
  return {
    name: frontmatter.name || name,
    description: frontmatter.description,
    model: frontmatter.model,
    allowedIntents: frontmatter.allowedIntents || [],
    web: frontmatter.web,
    notify: frontmatter.notify,
    mail: frontmatter.mail,
    scripts: frontmatter.scripts,
    artifacts: frontmatter.artifacts,
    actors: frontmatter.actors,
    path: file,
    raw,
    contextFiles,
    instructions: buildAgentInstructions(raw, contextFiles),
  };
}

async function loadAgentContext(name: string): Promise<AgentContextFile[]> {
  const dir = agentContextDir(name);
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((file) => file.endsWith(".md")).sort();
  const contextFiles: AgentContextFile[] = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    contextFiles.push({ name: file, path: filePath, content: await readFile(filePath, "utf8") });
  }
  return contextFiles;
}

function buildAgentInstructions(raw: string, contextFiles: AgentContextFile[]): string {
  const runtimeFrame = `---\n\n# jumpyGoatHq Runtime Frame\n\nYou are running as an jumpyGoatHq agent bundle. Treat the \`AGENT.md\` content above as the agent's identity, instructions, defaults, and capability policy. jumpyGoatHq loads only this file plus the scoped \`context/*.md\` files included below; other agent-local directories are reserved unless a future jumpyGoatHq contract explicitly loads them.\n\n## Connector and tool boundary\n\nUse only tools exposed to Pi for this run. External service access, secrets, network side effects, and notifications must go through jumpyGoatHq connector tools enabled by the agent's \`allowedIntents\` and the invocation config. Do not treat local scripts, references, or instructions as permission to bypass connector policy.\n\n## Workspace and output\n\nRun inside the invocation workspace. Keep durable edits within the task/request scope, avoid touching jumpyGoatHq runtime state unless asked, and make final output concise, auditable, and specific to the automation or task prompt.\n`;

  if (!contextFiles.length) return `${raw.trimEnd()}\n\n${runtimeFrame}\n`;
  const context = contextFiles.map((file) => `## ${file.name}\n\n${file.content.trimEnd()}`).join("\n\n");
  return `${raw.trimEnd()}\n\n${runtimeFrame}\n# Loaded Agent Context\n\nThe following scoped markdown context files belong to this agent. Use them as local context for this run.\n\n${context}\n`;
}
