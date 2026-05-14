import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import type { RunRow } from "./readers.js";

const require = createRequire(import.meta.url);
const pepiconsRoot = path.dirname(path.dirname(path.dirname(require.resolve("pepicons"))));
const iconCache = new Map<string, string>();

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function layout(title: string, body: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · jumpyGoat</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <h1>jumpyGoat</h1>
  <nav><a href="/">${icon("grid")}Dashboard</a><a href="/automations">${icon("gear")}Automations</a><a href="/schedule">${icon("calendar")}Schedule</a><a href="/agents">${icon("book")}Agents</a><a href="/projects">Projects</a><a href="/tasks">Tasks</a><a href="/runs">${icon("clock")}Runs</a></nav>
  <hr>
  <main>
    ${body}
  </main>
</body>
</html>`;
}

export function icon(name: string): string {
  const cached = iconCache.get(name);
  if (cached) return cached;
  const filePath = path.join(pepiconsRoot, "svg", "pencil", `${name}.svg`);
  const svg = readFileSync(filePath, "utf8")
    .replace("<svg ", `<svg class="icon" aria-hidden="true" focusable="false" `);
  iconCache.set(name, svg);
  return svg;
}

export function status(value: string): string {
  const cls = value === "ok" ? "ok" : value === "running" ? "running" : "error";
  return `<span class="${cls}">${escapeHtml(value)}</span>`;
}

export function duration(ms: number | null): string {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function date(value: string | null): string {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? escapeHtml(value) : escapeHtml(parsed.toLocaleString());
}

export function runLink(run: RunRow): string {
  return `<a href="/runs/${encodeURIComponent(run.id)}"><code>${escapeHtml(run.id.slice(0, 10))}</code></a>`;
}

export function notFound(): string {
  return layout("Not found", `<h2>Not found</h2><p>No page exists at this path.</p>`);
}

export function errorPage(title: string, error: unknown): string {
  return layout(title, `<h2>${escapeHtml(title)}</h2><pre>${escapeHtml(error instanceof Error ? error.stack || error.message : String(error))}</pre>`);
}
