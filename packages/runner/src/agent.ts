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
  if (!contextFiles.length) return raw.trimEnd() + "\n";
  const context = contextFiles.map((file) => `## ${file.name}\n\n${file.content.trimEnd()}`).join("\n\n");
  return `${raw.trimEnd()}\n\n---\n\n# Agent Context\n\nThe following scoped markdown context files belong to this agent. Use them as local context for this run.\n\n${context}\n`;
}
