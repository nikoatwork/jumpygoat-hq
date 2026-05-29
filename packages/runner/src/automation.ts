import { readFile } from "node:fs/promises";
import matter from "gray-matter";
import { z } from "zod";
import { automationPath } from "./paths.js";

const FirecrawlToolConfig = z.object({
  enabled: z.boolean().optional(),
  connector: z.literal("firecrawl"),
  timeoutMs: z.number().int().positive().optional(),
  maxOutputChars: z.number().int().positive().optional(),
});

const WebSearchConfig = FirecrawlToolConfig.extend({
  limit: z.number().int().min(1).max(10).optional(),
});

const WebScrapeConfig = FirecrawlToolConfig;

const WebCrawlConfig = FirecrawlToolConfig.extend({
  maxPages: z.number().int().min(1).max(10).optional(),
  maxDepth: z.number().int().min(0).max(3).optional(),
});

const NotifyEmailConfig = z.object({
  enabled: z.boolean().optional(),
  connector: z.literal("resend").optional().default("resend"),
  to: z.string().optional(),
  from: z.string().optional(),
  subjectPrefix: z.string().optional(),
});

const AgentMailToolConfig = z.object({
  enabled: z.boolean().optional(),
  connector: z.literal("agentmail"),
  inboxId: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
});

const AgentMailSendConfig = AgentMailToolConfig.extend({
  to: z.string().optional(),
  subjectPrefix: z.string().optional(),
  labels: z.array(z.string()).optional(),
});

const AgentMailListConfig = AgentMailToolConfig.extend({
  limit: z.number().int().min(1).max(50).optional(),
  labels: z.array(z.string()).optional(),
  maxOutputChars: z.number().int().positive().optional(),
});

const ScriptRunConfig = z.object({
  enabled: z.boolean().optional(),
  connector: z.literal("local-script"),
  allow: z.array(z.string()).optional(),
  network: z.boolean().optional(),
  write: z.boolean().optional(),
  timeoutMs: z.number().int().positive().optional(),
  maxOutputChars: z.number().int().positive().optional(),
});

export const ConnectorOverridesSchema = z.object({
  web: z.object({
    search: WebSearchConfig.optional(),
    scrape: WebScrapeConfig.optional(),
    crawl: WebCrawlConfig.optional(),
  }).optional(),
  notify: z.object({
    email: NotifyEmailConfig.optional(),
  }).optional(),
  mail: z.object({
    send: AgentMailSendConfig.optional(),
    list: AgentMailListConfig.optional(),
  }).optional(),
  scripts: z.object({
    run: ScriptRunConfig.optional(),
  }).optional(),
});

export type ConnectorOverrides = z.infer<typeof ConnectorOverridesSchema>;

const AutomationFrontmatter = ConnectorOverridesSchema.extend({
  agent: z.string().min(1),
  schedule: z.string().optional(),
  model: z.string().optional(),
}).strict();

export type Automation = z.infer<typeof AutomationFrontmatter> & {
  name: string;
  prompt: string;
};

export function assertValidAutomationName(name: string): void {
  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error(`Invalid automation name: ${name}. Use lowercase letters, numbers, and hyphens.`);
  }
}

export async function loadAutomation(name: string): Promise<Automation> {
  assertValidAutomationName(name);
  const file = automationPath(name);
  const raw = await readFile(file, "utf8").catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read automation ${name} at ${file}: ${message}`);
  });

  const parsed = matter(raw);
  const frontmatter = AutomationFrontmatter.parse(parsed.data);
  const prompt = parsed.content.trim();
  if (!prompt) throw new Error(`Automation ${name} has an empty prompt body.`);

  return { name, prompt, ...frontmatter };
}
