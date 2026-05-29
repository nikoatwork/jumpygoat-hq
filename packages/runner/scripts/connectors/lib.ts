import { loadDotEnv } from "../../src/env.js";
import type { ConnectorToolDefinition, ConnectorToolName } from "../../src/connectors/types.js";

export type Flags = {
  json: boolean;
  help: boolean;
  values: Record<string, string>;
  bools: Set<string>;
};

export function bootSmokeScript(argv = process.argv.slice(2)): Flags {
  loadDotEnv();
  return parseFlags(argv);
}

export function parseFlags(argv: string[]): Flags {
  const values: Record<string, string> = {};
  const bools = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (!arg.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    if (!key) continue;
    if (inlineValue !== undefined) {
      values[key] = inlineValue;
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      values[key] = next;
      index += 1;
    } else {
      bools.add(key);
    }
  }
  return { json: bools.has("json"), help: bools.has("help") || bools.has("h"), values, bools };
}

export function flag(flags: Flags, name: string, fallback?: string): string | undefined {
  return flags.values[name] ?? process.env[name.replaceAll("-", "_").toUpperCase()] ?? fallback;
}

export function boolFlag(flags: Flags, name: string): boolean {
  const value = flags.values[name];
  if (value !== undefined) return ["1", "true", "yes", "on"].includes(value.toLowerCase());
  return flags.bools.has(name);
}

export function numberFlag(flags: Flags, name: string, fallback: number): number {
  const value = flags.values[name];
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`--${name} must be a number.`);
  return parsed;
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Add it to .env.local or export it in this shell.`);
  return value;
}

export function printResult(flags: Flags, result: unknown, human: string): void {
  if (flags.json) console.log(JSON.stringify(result, null, 2));
  else console.log(human);
}

export function printHelp(text: string): void {
  console.log(text.trim());
}

export function tool<TParams>(tools: ConnectorToolDefinition[], name: ConnectorToolName): ConnectorToolDefinition<TParams> {
  const found = tools.find((entry) => entry.name === name) as ConnectorToolDefinition<TParams> | undefined;
  if (!found) throw new Error(`Connector tool not exposed: ${name}. Check allowedIntents and connector frontmatter plumbing.`);
  return found;
}

export function summarizeToolResult(result: Awaited<ReturnType<ConnectorToolDefinition["execute"]>>): Record<string, unknown> {
  return {
    text: result.content.map((item) => item.text).join("\n").slice(0, 2000),
    connectorSummary: result.details?.connectorSummary,
  };
}

export async function main(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}
