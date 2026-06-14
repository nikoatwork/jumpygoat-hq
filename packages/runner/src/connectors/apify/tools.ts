import { ApifyClient } from "apify-client";
import { clampNumber, connectorSummary, errorMessage, textFromUnknown, truncateText } from "../helpers.js";
import type { ConnectorRuntimeConfig, ConnectorToolDefinition } from "../types.js";

type ApifyRunActorParams = {
  actor?: string;
  input?: Record<string, unknown>;
  maxOutputItems?: number;
  maxOutputChars?: number;
};

type ApifyRunLike = {
  id?: string;
  status?: string;
  defaultDatasetId?: string | null;
};

type ApifyDatasetListLike = {
  items?: unknown[];
  total?: number;
  count?: number;
  limit?: number;
  offset?: number;
};

type ApifyClientLike = {
  actor(actorId: string): {
    call(input?: unknown, options?: { waitSecs?: number; log?: null }): Promise<ApifyRunLike>;
  };
  dataset(datasetId: string): {
    listItems(options?: { limit?: number; clean?: boolean }): Promise<ApifyDatasetListLike>;
  };
};

type JsonObject = Record<string, unknown>;

export function createApifyTools(runtime: ConnectorRuntimeConfig, client?: ApifyClientLike): ConnectorToolDefinition[] {
  return [createRunActorTool(runtime, client)];
}

function apifyDefaults(runtime: ConnectorRuntimeConfig): Required<NonNullable<ConnectorRuntimeConfig["apify"]>> {
  return {
    allow: runtime.apify?.allow ?? [],
    actor: runtime.apify?.actor ?? "",
    input: runtime.apify?.input ?? {},
    timeoutMs: runtime.apify?.timeoutMs ?? 300_000,
    maxOutputItems: runtime.apify?.maxOutputItems ?? 25,
    maxOutputChars: runtime.apify?.maxOutputChars ?? 20_000,
  };
}

function createRunActorTool(runtime: ConnectorRuntimeConfig, injectedClient?: ApifyClientLike): ConnectorToolDefinition<ApifyRunActorParams> {
  return {
    name: "apify_run_actor",
    label: "Run Apify Actor",
    description: "Run one agent-allowlisted Apify actor and return a bounded default dataset preview. Requires APIFY_API_TOKEN or APIFY_API_KEY.",
    promptSnippet: "Run an allowlisted Apify actor and inspect a bounded dataset preview",
    promptGuidelines: [
      "Use apify_run_actor only when the automation needs data from one of the agent-allowlisted Apify actors.",
      "Do not pass executable code or function-shaped actor input; use JSON/YAML data only.",
    ],
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        actor: { type: "string", minLength: 1, description: "Optional Apify actor ID. Defaults to actors.run.actor from frontmatter and must be allowlisted by the agent." },
        input: { type: "object", description: "Optional JSON-serializable actor input merged over automation defaults." },
        maxOutputItems: { type: "number", minimum: 1, maximum: 100, description: "Maximum dataset items to preview (default from config, max 100)." },
        maxOutputChars: { type: "number", minimum: 1000, maximum: 50000, description: "Maximum characters returned to Pi (default from config, max 50000)." },
      },
    },
    async execute(toolCallId, params, signal) {
      const startedAt = new Date().toISOString();
      const defaults = apifyDefaults(runtime);
      const actorId = String(params.actor || defaults.actor || "").trim();
      const maxOutputItems = clampNumber(params.maxOutputItems, defaults.maxOutputItems, 1, 100);
      const maxOutputChars = clampNumber(params.maxOutputChars, defaults.maxOutputChars, 1_000, 50_000);
      try {
        const apiToken = apifyApiToken();
        if (!apiToken) throw new Error("Missing APIFY_API_TOKEN or APIFY_API_KEY.");
        if (!actorId) throw new Error("apify_run_actor actor is required via tool params or actors.run.actor.");
        assertSafeActorId(actorId);
        if (!defaults.allow.includes(actorId)) throw new Error(`Apify actor is not allowlisted by the agent: ${actorId}`);
        assertNotCancelled(signal);

        const baseInput = sanitizeJsonObject(defaults.input, "actors.run.input");
        const overrideInput = params.input === undefined ? {} : sanitizeJsonObject(params.input, "input");
        const input = deepMergeJsonObjects(baseInput, overrideInput);
        assertNotCancelled(signal);

        const client: ApifyClientLike = injectedClient ?? (new ApifyClient({ token: apiToken }) as unknown as ApifyClientLike);
        const waitSecs = Math.max(1, Math.ceil(defaults.timeoutMs / 1000));
        const run = await client.actor(actorId).call(input, { waitSecs, log: null });
        assertNotCancelled(signal);
        if (run.status && run.status !== "SUCCEEDED") throw new Error(`Apify actor run finished with status ${run.status}.`);
        const datasetId = typeof run.defaultDatasetId === "string" ? run.defaultDatasetId : "";
        if (!datasetId) throw new Error("Apify actor run did not produce a default dataset.");

        const dataset = await client.dataset(datasetId).listItems({ limit: maxOutputItems, clean: true });
        const items = Array.isArray(dataset.items) ? dataset.items : [];
        const datasetUrl = `https://console.apify.com/storage/datasets/${datasetId}`;
        const text = formatActorResult({ actorId, run, datasetId, datasetUrl, items, total: dataset.total, maxOutputChars });
        const finishedAt = new Date().toISOString();
        const summary = connectorSummary({
          runId: runtime.runId,
          automation: runtime.automationName,
          agent: runtime.agentName,
          toolCallId,
          intent: "actor.run",
          toolName: "apify_run_actor",
          connector: "apify",
          status: "succeeded",
          startedAt,
          finishedAt,
          url: datasetUrl,
          actorId,
          providerRunId: run.id,
          datasetId,
          datasetUrl,
          itemCount: items.length,
          resultSummary: {
            actorId,
            runStatus: run.status,
            datasetId,
            datasetUrl,
            returnedItems: items.length,
            totalItems: dataset.total,
            inputKeys: Object.keys(input).slice(0, 50),
            outputChars: text.length,
          },
        });
        return { content: [{ type: "text", text }], details: { connectorSummary: summary } };
      } catch (error) {
        throw connectorToolError(error, { runtime, toolCallId, startedAt, actorId });
      }
    },
  };
}

function apifyApiToken(): string | undefined {
  return process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY;
}

function assertSafeActorId(actorId: string): void {
  if (actorId.length > 200) throw new Error("Apify actor ID is too long.");
  if (!/^[A-Za-z0-9][A-Za-z0-9._~/-]*$/.test(actorId)) throw new Error(`Invalid Apify actor ID: ${actorId}`);
  if (actorId.includes("..") || actorId.includes("//")) throw new Error(`Invalid Apify actor ID: ${actorId}`);
}

function sanitizeJsonObject(value: unknown, label: string): JsonObject {
  if (!isPlainObject(value)) throw new Error(`${label} must be a JSON object.`);
  assertJsonSafe(value, label);
  return value;
}

function assertJsonSafe(value: unknown, path: string): void {
  if (value === null) return;
  if (typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${path} contains a non-finite number.`);
    return;
  }
  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint" || value === undefined) {
    throw new Error(`${path} contains a non-JSON value.`);
  }
  if (Array.isArray(value)) {
    if (value.length > 1000) throw new Error(`${path} array is too large.`);
    value.forEach((entry, index) => assertJsonSafe(entry, `${path}[${index}]`));
    return;
  }
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length > 500) throw new Error(`${path} object has too many keys.`);
    for (const [key, entry] of entries) {
      if (!key || key.length > 200) throw new Error(`${path} contains an invalid key.`);
      if (/function/i.test(key)) throw new Error(`${path}.${key} looks executable; function-shaped Apify input is not supported.`);
      assertJsonSafe(entry, `${path}.${key}`);
    }
    return;
  }
  throw new Error(`${path} contains a non-plain object.`);
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function deepMergeJsonObjects(base: JsonObject, override: JsonObject): JsonObject {
  const result: JsonObject = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const previous = result[key];
    result[key] = isPlainObject(previous) && isPlainObject(value) ? deepMergeJsonObjects(previous, value) : value;
  }
  return result;
}

function formatActorResult(args: {
  actorId: string;
  run: ApifyRunLike;
  datasetId: string;
  datasetUrl: string;
  items: unknown[];
  total?: number;
  maxOutputChars: number;
}): string {
  const preview = JSON.stringify(args.items, null, 2);
  const truncated = truncateText(preview, Math.max(1000, args.maxOutputChars - 500));
  const total = typeof args.total === "number" ? args.total : args.items.length;
  return truncateText(
    [
      `Apify actor run succeeded.`,
      `Actor: ${args.actorId}`,
      `Run ID: ${args.run.id || "unknown"}`,
      `Status: ${args.run.status || "unknown"}`,
      `Dataset ID: ${args.datasetId}`,
      `Dataset URL: ${args.datasetUrl}`,
      `Preview items: ${args.items.length} of ${total}`,
      ``,
      `Dataset preview JSON${truncated.truncated ? " (truncated)" : ""}:`,
      truncated.text,
    ].join("\n"),
    args.maxOutputChars,
  ).text;
}

function connectorToolError(error: unknown, args: {
  runtime: ConnectorRuntimeConfig;
  toolCallId: string;
  startedAt: string;
  actorId?: string;
}): Error {
  const message = errorMessage(error);
  const summary = connectorSummary({
    runId: args.runtime.runId,
    automation: args.runtime.automationName,
    agent: args.runtime.agentName,
    toolCallId: args.toolCallId,
    intent: "actor.run",
    toolName: "apify_run_actor",
    connector: "apify",
    status: "failed",
    startedAt: args.startedAt,
    finishedAt: new Date().toISOString(),
    actorId: args.actorId,
    error: textFromUnknown(message, 1000),
  });
  const wrapped = new Error(message) as Error & { connectorSummary?: unknown };
  wrapped.connectorSummary = summary;
  return wrapped;
}

function assertNotCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error("Cancelled.");
}
