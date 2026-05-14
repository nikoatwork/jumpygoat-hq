export type NormalizedUsageEvent = {
  responseId?: string;
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  totalTokens: number | null;
  costTotal: number | null;
  currency: string | null;
  provider: string | null;
  model: string | null;
  raw: unknown;
};

export type RunUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  cacheReadTokens: number | null;
  cacheWriteTokens: number | null;
  totalTokens: number | null;
  costTotal: number | null;
  currency: string | null;
  provider: string | null;
  model: string | null;
  events: NormalizedUsageEvent[];
};

type JsonObject = Record<string, unknown>;

export function extractUsageFromTraceText(traceText: string): RunUsage | null {
  const byResponseId = new Map<string, NormalizedUsageEvent>();
  const withoutResponseId: NormalizedUsageEvent[] = [];

  for (const rawLine of traceText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    for (const candidate of usageCandidates(event)) {
      const normalized = normalizeUsageCandidate(candidate.message, candidate.usage);
      if (!normalized) continue;
      if (normalized.responseId) {
        byResponseId.set(normalized.responseId, normalized);
      } else {
        withoutResponseId.push(normalized);
      }
    }
  }

  const events = [...byResponseId.values(), ...withoutResponseId];
  if (events.length === 0) return null;

  return {
    inputTokens: sumNullable(events, "inputTokens"),
    outputTokens: sumNullable(events, "outputTokens"),
    reasoningTokens: sumNullable(events, "reasoningTokens"),
    cacheReadTokens: sumNullable(events, "cacheReadTokens"),
    cacheWriteTokens: sumNullable(events, "cacheWriteTokens"),
    totalTokens: sumNullable(events, "totalTokens"),
    costTotal: sumNullable(events, "costTotal"),
    currency: lastString(events.map((event) => event.currency)),
    provider: lastString(events.map((event) => event.provider)),
    model: lastString(events.map((event) => event.model)),
    events,
  };
}

function usageCandidates(event: unknown): Array<{ message: JsonObject; usage: JsonObject }> {
  const candidates: Array<{ message: JsonObject; usage: JsonObject }> = [];
  const add = (message: unknown, usage: unknown) => {
    if (isObject(message) && isObject(usage)) candidates.push({ message, usage });
  };

  if (!isObject(event)) return candidates;
  add(event.message, isObject(event.message) ? event.message.usage : undefined);
  add(event.response, isObject(event.response) ? event.response.usage : undefined);
  add(event, event.usage);
  const update = event.assistantMessageEvent;
  if (isObject(update)) add(update.partial, isObject(update.partial) ? update.partial.usage : undefined);
  return candidates;
}

function normalizeUsageCandidate(message: JsonObject, usage: JsonObject): NormalizedUsageEvent | null {
  const inputTokens = numeric(usage.input, usage.inputTokens, usage.input_tokens, usage.promptTokens, usage.prompt_tokens);
  const outputTokens = numeric(usage.output, usage.outputTokens, usage.output_tokens, usage.completionTokens, usage.completion_tokens);
  const reasoningTokens = numeric(usage.reasoning, usage.reasoningTokens, usage.reasoning_tokens, nestedNumber(usage.outputDetails, "reasoning"), nestedNumber(usage.output_details, "reasoning"));
  const cacheReadTokens = numeric(usage.cacheRead, usage.cacheReadTokens, usage.cache_read, usage.cache_read_tokens, nestedNumber(usage.inputDetails, "cacheRead"), nestedNumber(usage.input_details, "cache_read"));
  const cacheWriteTokens = numeric(usage.cacheWrite, usage.cacheWriteTokens, usage.cache_write, usage.cache_write_tokens, nestedNumber(usage.inputDetails, "cacheWrite"), nestedNumber(usage.input_details, "cache_write"));
  const totalTokens = numeric(usage.totalTokens, usage.total_tokens, usage.total);
  const cost = isObject(usage.cost) ? usage.cost : undefined;
  const costTotal = numeric(usage.costTotal, usage.cost_total, cost?.total, cost?.amount);
  const currency = stringValue(usage.currency) || stringValue(cost?.currency) || null;
  const provider = stringValue(message.provider) || stringValue(usage.provider) || null;
  const model = stringValue(message.model) || stringValue(usage.model) || null;

  const hasAnyUsage = [inputTokens, outputTokens, reasoningTokens, cacheReadTokens, cacheWriteTokens, totalTokens, costTotal].some((value) => value != null);
  if (!hasAnyUsage) return null;

  return {
    responseId: stringValue(message.responseId) || stringValue(message.response_id) || undefined,
    inputTokens,
    outputTokens,
    reasoningTokens,
    cacheReadTokens,
    cacheWriteTokens,
    totalTokens,
    costTotal,
    currency,
    provider,
    model,
    raw: usage,
  };
}

function sumNullable<T extends keyof NormalizedUsageEvent>(events: NormalizedUsageEvent[], key: T): number | null {
  let sum = 0;
  let seen = false;
  for (const event of events) {
    const value = event[key];
    if (typeof value === "number") {
      sum += value;
      seen = true;
    }
  }
  return seen ? sum : null;
}

function numeric(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function nestedNumber(value: unknown, key: string): unknown {
  return isObject(value) ? value[key] : undefined;
}

function lastString(values: Array<string | null>): string | null {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index]) return values[index]!;
  }
  return null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function isObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
