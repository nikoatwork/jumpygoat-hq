import { fetchWithTimeout, parseResponseBody, responseErrorDetail } from "../helpers.js";

const FIRECRAWL_API_BASE = "https://api.firecrawl.dev/v1";

export async function firecrawlRequest(path: string, args: {
  apiKey: string;
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<unknown> {
  const response = await fetchWithTimeout(
    `${FIRECRAWL_API_BASE}${path}`,
    {
      method: args.method ?? "POST",
      headers: {
        authorization: `Bearer ${args.apiKey}`,
        "content-type": "application/json",
      },
      body: args.body ? JSON.stringify(args.body) : undefined,
    },
    args.timeoutMs,
    args.signal,
  );

  const body = await parseResponseBody(response);
  if (!response.ok) throw new Error(`Firecrawl API ${response.status}: ${responseErrorDetail(body)}`);
  return body;
}

export function responseData(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "data" in payload) return (payload as { data: unknown }).data;
  return payload;
}

export function responseSuccess(payload: unknown): boolean {
  if (!payload || typeof payload !== "object" || !("success" in payload)) return true;
  return (payload as { success: unknown }).success !== false;
}

export function responseId(payload: unknown): string | undefined {
  if (payload && typeof payload === "object" && "id" in payload) return String((payload as { id: unknown }).id);
  return undefined;
}
