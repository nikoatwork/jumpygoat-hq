import { createAgentMailTools } from "./agentmail/index.js";
import { createArtifactTools } from "./artifacts/index.js";
import { createFirecrawlTools } from "./firecrawl/index.js";
import { createResendTools } from "./resend/index.js";
import { createScriptRunTools } from "./script/index.js";
import type { ConnectorRuntimeConfig, ConnectorToolDefinition, ConnectorToolName } from "./types.js";

const CONFIG_ENV = "JUMPYGOATHQ_CONNECTORS_CONFIG_JSON";

type PiLike = {
  registerTool(tool: ConnectorToolDefinition): void;
};

export default function jumpyGoatHqConnectorExtension(pi: PiLike): void {
  const runtime = parseRuntimeConfig(process.env[CONFIG_ENV]);
  if (!runtime || runtime.tools.length === 0) return;

  const allowedNames = new Set<ConnectorToolName>(runtime.tools.map((tool) => tool.toolName));
  const definitions = [...createFirecrawlTools(runtime), ...createResendTools(runtime), ...createAgentMailTools(runtime), ...createScriptRunTools(runtime), ...createArtifactTools(runtime)];
  for (const definition of definitions) {
    if (allowedNames.has(definition.name)) pi.registerTool(definition);
  }
}

export function parseRuntimeConfig(raw: string | undefined): ConnectorRuntimeConfig | undefined {
  if (!raw) return undefined;
  const parsed = JSON.parse(raw) as ConnectorRuntimeConfig;
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.tools)) {
    throw new Error(`${CONFIG_ENV} must contain a connector runtime config with a tools array.`);
  }
  return parsed;
}
