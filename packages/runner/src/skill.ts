import { readFile } from "node:fs/promises";
import matter from "gray-matter";
import { z } from "zod";
import { skillPath } from "./paths.js";

const SkillFrontmatter = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  allowedIntents: z.array(z.string()).optional(),
});

export type SkillMeta = {
  name: string;
  allowedIntents: string[];
};

export async function loadSkillMeta(name: string): Promise<SkillMeta> {
  const raw = await readFile(skillPath(name), "utf8");
  const parsed = matter(raw);
  const frontmatter = SkillFrontmatter.parse(parsed.data);
  return {
    name: frontmatter.name || name,
    allowedIntents: frontmatter.allowedIntents || [],
  };
}
