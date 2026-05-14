import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import type { RunRow } from "./readers.js";

const require = createRequire(import.meta.url);
const pepiconsRoot = path.dirname(path.dirname(path.dirname(require.resolve("pepicons"))));
const iconCache = new Map<string, string>();

export type HtmlFragment = { html: string };
export type TableCell = HtmlFragment | string | number | null | undefined;

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Use raw() only for trusted route-built fragments that intentionally contain markup.
export function raw(html: string): HtmlFragment {
  return { html };
}

function renderCell(cell: TableCell): string {
  return typeof cell === "object" && cell !== null && "html" in cell ? cell.html : escapeHtml(cell);
}

function classAttr(base: string, extra?: string): string {
  return extra ? `${base} ${escapeHtml(extra)}` : base;
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

export function pageHeader(title: string, options: { description?: string; actions?: string; meta?: string } = {}): string {
  return `<header class="page-header"><div><h2>${escapeHtml(title)}</h2>${options.description ? `<p class="muted">${escapeHtml(options.description)}</p>` : ""}${options.meta ? `<p class="muted">${options.meta}</p>` : ""}</div>${options.actions ? `<div class="page-actions">${options.actions}</div>` : ""}</header>`;
}

export function section(title: string, body: string, options: { actions?: string; className?: string } = {}): string {
  return `<section class="${classAttr("section", options.className)}">${title || options.actions ? `<header class="section-header">${title ? `<h3>${escapeHtml(title)}</h3>` : ""}${options.actions ? `<div class="section-actions">${options.actions}</div>` : ""}</header>` : ""}${body}</section>`;
}

export function toolbar(content: string): string {
  return `<div class="toolbar">${content}</div>`;
}

export function inlineActions(content: string): string {
  return `<div class="inline-actions">${content}</div>`;
}

export function notice(message: unknown, tone: "info" | "success" | "warning" | "error" = "info"): string {
  return `<p class="notice ${escapeHtml(tone)}">${escapeHtml(message)}</p>`;
}

export function badge(label: unknown, tone = ""): string {
  return `<span class="${classAttr("badge", tone)}">${escapeHtml(label)}</span>`;
}

export function emptyState(message: unknown, action = ""): string {
  return `<p class="empty-state">${escapeHtml(message)}${action ? ` <span>${action}</span>` : ""}</p>`;
}

export function table(headers: TableCell[], rows: TableCell[][], options: { className?: string; empty?: string } = {}): string {
  if (rows.length === 0) return emptyState(options.empty || "No records found.");
  const classes = options.className ? ` class="${escapeHtml(options.className)}"` : "";
  return `<div class="table-wrap"><table${classes}><tr>${headers.map((header) => `<th>${renderCell(header)}</th>`).join("")}</tr>${rows.map((row) => `<tr>${row.map((cell) => `<td>${renderCell(cell)}</td>`).join("")}</tr>`).join("")}</table></div>`;
}

export function metaTable(rows: Array<[TableCell, TableCell]>): string {
  return `<div class="table-wrap"><table class="meta-table">${rows.map(([key, value]) => `<tr><th>${renderCell(key)}</th><td>${renderCell(value)}</td></tr>`).join("")}</table></div>`;
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
  return layout("Not found", `${pageHeader("Not found")}<p>No page exists at this path.</p>`);
}

export function errorPage(title: string, error: unknown): string {
  return layout(title, `${pageHeader(title)}<pre>${escapeHtml(error instanceof Error ? error.stack || error.message : String(error))}</pre>`);
}
