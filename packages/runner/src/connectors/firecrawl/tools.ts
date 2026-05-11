import { clampNumber, connectorSummary, errorMessage, requireHttpUrl, textFromUnknown, truncateText } from "../helpers.js";
import type { ConnectorRuntimeConfig, ConnectorToolDefinition } from "../types.js";
import { firecrawlRequest, responseData, responseId, responseSuccess } from "./client.js";

type WebSearchParams = { query: string; limit?: number };
type WebScrapeParams = { url: string; formats?: string[]; onlyMainContent?: boolean; maxOutputChars?: number };
type WebCrawlParams = { url: string; maxPages?: number; maxDepth?: number; maxOutputChars?: number };

type FirecrawlItem = Record<string, unknown>;

export function createFirecrawlTools(runtime: ConnectorRuntimeConfig): ConnectorToolDefinition[] {
  return [createSearchTool(runtime), createScrapeTool(runtime), createCrawlTool(runtime)];
}

function firecrawlDefaults(runtime: ConnectorRuntimeConfig): Required<NonNullable<ConnectorRuntimeConfig["firecrawl"]>> {
  return {
    timeoutMs: runtime.firecrawl?.timeoutMs ?? 45_000,
    maxOutputChars: runtime.firecrawl?.maxOutputChars ?? 12_000,
    searchLimit: runtime.firecrawl?.searchLimit ?? 5,
    crawlMaxPages: runtime.firecrawl?.crawlMaxPages ?? 5,
    crawlMaxDepth: runtime.firecrawl?.crawlMaxDepth ?? 1,
  };
}

function createSearchTool(runtime: ConnectorRuntimeConfig): ConnectorToolDefinition<WebSearchParams> {
  return {
    name: "web_search",
    label: "Web Search",
    description: "Search the web through Firecrawl and return bounded results. Requires FIRECRAWL_API_KEY.",
    promptSnippet: "Search the web with Firecrawl and return concise result snippets",
    promptGuidelines: ["Use web_search when current web results would materially improve the automation answer."],
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: { type: "string", minLength: 1, description: "Search query." },
        limit: { type: "number", minimum: 1, maximum: 10, description: "Maximum results to return (default from automation config, max 10)." },
      },
    },
    async execute(toolCallId, params, signal) {
      const startedAt = new Date().toISOString();
      const defaults = firecrawlDefaults(runtime);
      const query = String(params.query || "").trim();
      const limit = clampNumber(params.limit, defaults.searchLimit, 1, 10);
      try {
        if (!process.env.FIRECRAWL_API_KEY) throw new Error("Missing FIRECRAWL_API_KEY.");
        if (!query) throw new Error("web_search query is required.");
        const payload = await firecrawlRequest("/search", {
          apiKey: process.env.FIRECRAWL_API_KEY,
          timeoutMs: defaults.timeoutMs,
          body: { query, limit },
          signal,
        });
        assertFirecrawlSuccess(payload);
        const items = asItems(responseData(payload)).slice(0, limit);
        const text = formatSearchResults(items, defaults.maxOutputChars);
        const finishedAt = new Date().toISOString();
        const summary = connectorSummary({
          runId: runtime.runId,
          automation: runtime.automationName,
          skill: runtime.skillName,
          toolCallId,
          intent: "web.search",
          toolName: "web_search",
          connector: "firecrawl",
          status: "succeeded",
          startedAt,
          finishedAt,
          query,
          resultSummary: { resultCount: items.length, limit, urls: items.map(itemUrl).filter(Boolean).slice(0, 10) },
        });
        return { content: [{ type: "text", text }], details: { connectorSummary: summary } };
      } catch (error) {
        throw connectorToolError(error, { runtime, toolCallId, startedAt, intent: "web.search", toolName: "web_search", query });
      }
    },
  };
}

function createScrapeTool(runtime: ConnectorRuntimeConfig): ConnectorToolDefinition<WebScrapeParams> {
  return {
    name: "web_scrape",
    label: "Web Scrape",
    description: "Scrape one HTTP(S) URL through Firecrawl and return bounded page content. Requires FIRECRAWL_API_KEY.",
    promptSnippet: "Scrape a single web page with Firecrawl",
    promptGuidelines: ["Use web_scrape when the automation needs current content from a specific URL."],
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["url"],
      properties: {
        url: { type: "string", minLength: 1, description: "HTTP(S) URL to scrape." },
        formats: { type: "array", items: { type: "string" }, description: "Firecrawl formats, default markdown." },
        onlyMainContent: { type: "boolean", description: "Request only main page content, default true." },
        maxOutputChars: { type: "number", minimum: 1000, maximum: 20000, description: "Optional output bound for this call." },
      },
    },
    async execute(toolCallId, params, signal) {
      const startedAt = new Date().toISOString();
      const defaults = firecrawlDefaults(runtime);
      const url = String(params.url || "").trim();
      const maxOutputChars = clampNumber(params.maxOutputChars, defaults.maxOutputChars, 1_000, 20_000);
      try {
        if (!process.env.FIRECRAWL_API_KEY) throw new Error("Missing FIRECRAWL_API_KEY.");
        requireHttpUrl(url);
        const formats = Array.isArray(params.formats) && params.formats.length ? params.formats.slice(0, 4) : ["markdown"];
        const payload = await firecrawlRequest("/scrape", {
          apiKey: process.env.FIRECRAWL_API_KEY,
          timeoutMs: defaults.timeoutMs,
          body: { url, formats, onlyMainContent: params.onlyMainContent ?? true },
          signal,
        });
        assertFirecrawlSuccess(payload);
        const data = asRecord(responseData(payload));
        const text = formatScrapeResult(data, maxOutputChars);
        const finishedAt = new Date().toISOString();
        const summary = connectorSummary({
          runId: runtime.runId,
          automation: runtime.automationName,
          skill: runtime.skillName,
          toolCallId,
          intent: "web.scrape",
          toolName: "web_scrape",
          connector: "firecrawl",
          status: "succeeded",
          startedAt,
          finishedAt,
          url,
          resultSummary: { title: textFromUnknown(data.title ?? asRecord(data.metadata).title, 200), outputChars: text.length, formats },
        });
        return { content: [{ type: "text", text }], details: { connectorSummary: summary } };
      } catch (error) {
        throw connectorToolError(error, { runtime, toolCallId, startedAt, intent: "web.scrape", toolName: "web_scrape", url });
      }
    },
  };
}

function createCrawlTool(runtime: ConnectorRuntimeConfig): ConnectorToolDefinition<WebCrawlParams> {
  return {
    name: "web_crawl",
    label: "Web Crawl",
    description: "Crawl a site through Firecrawl with small page/depth limits and return bounded page summaries. Requires FIRECRAWL_API_KEY.",
    promptSnippet: "Crawl a small bounded set of pages with Firecrawl",
    promptGuidelines: ["Use web_crawl only for small bounded crawls; prefer web_scrape for one known page."],
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["url"],
      properties: {
        url: { type: "string", minLength: 1, description: "HTTP(S) URL to crawl from." },
        maxPages: { type: "number", minimum: 1, maximum: 10, description: "Maximum pages to crawl, max 10." },
        maxDepth: { type: "number", minimum: 0, maximum: 3, description: "Maximum crawl depth, max 3." },
        maxOutputChars: { type: "number", minimum: 1000, maximum: 20000, description: "Optional output bound for this call." },
      },
    },
    async execute(toolCallId, params, signal) {
      const startedAt = new Date().toISOString();
      const defaults = firecrawlDefaults(runtime);
      const url = String(params.url || "").trim();
      const maxPages = clampNumber(params.maxPages, defaults.crawlMaxPages, 1, 10);
      const maxDepth = clampNumber(params.maxDepth, defaults.crawlMaxDepth, 0, 3);
      const maxOutputChars = clampNumber(params.maxOutputChars, defaults.maxOutputChars, 1_000, 20_000);
      try {
        if (!process.env.FIRECRAWL_API_KEY) throw new Error("Missing FIRECRAWL_API_KEY.");
        requireHttpUrl(url);
        const payload = await firecrawlRequest("/crawl", {
          apiKey: process.env.FIRECRAWL_API_KEY,
          timeoutMs: defaults.timeoutMs,
          body: {
            url,
            limit: maxPages,
            maxDepth,
            scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
          },
          signal,
        });
        assertFirecrawlSuccess(payload);
        const data = await resolveCrawlData(payload, process.env.FIRECRAWL_API_KEY, defaults.timeoutMs, signal);
        const items = asItems(data).slice(0, maxPages);
        const text = formatCrawlResults(items, maxOutputChars);
        const finishedAt = new Date().toISOString();
        const summary = connectorSummary({
          runId: runtime.runId,
          automation: runtime.automationName,
          skill: runtime.skillName,
          toolCallId,
          intent: "web.crawl",
          toolName: "web_crawl",
          connector: "firecrawl",
          status: "succeeded",
          startedAt,
          finishedAt,
          url,
          resultSummary: { pageCount: items.length, maxPages, maxDepth, urls: items.map(itemUrl).filter(Boolean).slice(0, 10) },
        });
        return { content: [{ type: "text", text }], details: { connectorSummary: summary } };
      } catch (error) {
        throw connectorToolError(error, { runtime, toolCallId, startedAt, intent: "web.crawl", toolName: "web_crawl", url });
      }
    },
  };
}

async function resolveCrawlData(payload: unknown, apiKey: string, timeoutMs: number, signal?: AbortSignal): Promise<unknown> {
  const immediate = responseData(payload);
  if (Array.isArray(immediate)) return immediate;
  const id = responseId(payload);
  if (!id) return immediate;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(1500, signal);
    const status = await firecrawlRequest(`/crawl/${encodeURIComponent(id)}`, { apiKey, method: "GET", timeoutMs: Math.max(1000, deadline - Date.now()), signal });
    assertFirecrawlSuccess(status);
    const record = asRecord(status);
    const state = String(record.status || record.state || "").toLowerCase();
    const data = responseData(status);
    if (Array.isArray(data)) return data;
    if (["completed", "complete", "finished", "done"].includes(state)) return data;
    if (["failed", "error", "cancelled", "canceled"].includes(state)) throw new Error(`Firecrawl crawl ${state}.`);
  }
  throw new Error(`Firecrawl crawl polling timed out after ${timeoutMs}ms.`);
}

function assertFirecrawlSuccess(payload: unknown): void {
  if (!responseSuccess(payload)) {
    const record = asRecord(payload);
    throw new Error(textFromUnknown(record.error ?? record.message ?? payload, 500) || "Firecrawl request failed.");
  }
}

function formatSearchResults(items: FirecrawlItem[], maxOutputChars: number): string {
  if (!items.length) return "No Firecrawl search results.";
  const lines = items.map((item, index) => {
    const title = textFromUnknown(item.title, 200) || "Untitled";
    const url = itemUrl(item) || "(no url)";
    const description = textFromUnknown(item.description ?? item.snippet ?? item.markdown ?? item.content, 500) || "";
    return `${index + 1}. ${title}\n   ${url}${description ? `\n   ${description}` : ""}`;
  });
  return truncateText(lines.join("\n\n"), maxOutputChars).text;
}

function formatScrapeResult(data: FirecrawlItem, maxOutputChars: number): string {
  const metadata = asRecord(data.metadata);
  const title = textFromUnknown(data.title ?? metadata.title, 300);
  const sourceUrl = textFromUnknown(data.url ?? metadata.sourceURL ?? metadata.url, 500);
  const main = textFromUnknown(data.markdown ?? data.html ?? data.rawHtml ?? data.extract ?? data.content ?? data, maxOutputChars) || "";
  const header = [title ? `Title: ${title}` : undefined, sourceUrl ? `URL: ${sourceUrl}` : undefined].filter(Boolean).join("\n");
  return truncateText(`${header}${header ? "\n\n" : ""}${main}`, maxOutputChars).text;
}

function formatCrawlResults(items: FirecrawlItem[], maxOutputChars: number): string {
  if (!items.length) return "No Firecrawl crawl pages returned.";
  const perPage = Math.max(500, Math.floor(maxOutputChars / items.length));
  const pages = items.map((item, index) => {
    const metadata = asRecord(item.metadata);
    const title = textFromUnknown(item.title ?? metadata.title, 200) || `Page ${index + 1}`;
    const url = itemUrl(item) || textFromUnknown(metadata.sourceURL ?? metadata.url, 500) || "(no url)";
    const body = textFromUnknown(item.markdown ?? item.content ?? item.description ?? item, perPage) || "";
    return `## ${index + 1}. ${title}\n${url}\n\n${body}`;
  });
  return truncateText(pages.join("\n\n---\n\n"), maxOutputChars).text;
}

function itemUrl(item: FirecrawlItem): string | undefined {
  return textFromUnknown(item.url ?? item.link ?? asRecord(item.metadata).sourceURL ?? asRecord(item.metadata).url, 500);
}

function asItems(value: unknown): FirecrawlItem[] {
  if (Array.isArray(value)) return value.map(asRecord);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["results", "items", "pages", "documents"]) {
      if (Array.isArray(record[key])) return record[key].map(asRecord);
    }
  }
  return value === undefined ? [] : [asRecord(value)];
}

function asRecord(value: unknown): FirecrawlItem {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as FirecrawlItem) : {};
}

function connectorToolError(error: unknown, args: {
  runtime: ConnectorRuntimeConfig;
  toolCallId: string;
  startedAt: string;
  intent: "web.search" | "web.scrape" | "web.crawl";
  toolName: "web_search" | "web_scrape" | "web_crawl";
  query?: string;
  url?: string;
}): Error {
  const message = errorMessage(error);
  const summary = connectorSummary({
    runId: args.runtime.runId,
    automation: args.runtime.automationName,
    skill: args.runtime.skillName,
    toolCallId: args.toolCallId,
    intent: args.intent,
    toolName: args.toolName,
    connector: "firecrawl",
    status: "failed",
    startedAt: args.startedAt,
    finishedAt: new Date().toISOString(),
    query: args.query,
    url: args.url,
    error: message,
  });
  const wrapped = new Error(message) as Error & { connectorSummary?: unknown };
  wrapped.connectorSummary = summary;
  return wrapped;
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new Error("Cancelled.");
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    const onAbort = (): void => {
      clearTimeout(timeout);
      reject(new Error("Cancelled."));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
