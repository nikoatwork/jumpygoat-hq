import { readFileSync } from "node:fs";

import type { RunRow } from "./readers.js";

const iconCache = new Map<string, string>();
const uiIconMap: Record<string, string> = {
  overview: "apps",
  dashboard: "apps",
  tasks: "list-ul",
  task: "check-square",
  boards: "layer-group",
  board: "layer-group",
  automations: "process",
  automation: "process",
  schedule: "calendar",
  agents: "shield-plus",
  agent: "shield-plus",
  runs: "history",
  run: "rocket",
  settings: "key-skeleton",
  create: "plus-square",
  add: "plus-square",
  edit: "document-layout-left",
  delete: "times-circle",
  save: "check",
  status: "check-circle",
  success: "check-circle",
  warning: "exclamation-triangle",
  error: "exclamation-octagon",
  model: "graph-bar",
  usage: "analytics",
  connector: "link-h",
  secure: "lock",
  local: "lock-open-alt",
  table: "table",
  details: "document-layout-left",
  activity: "history",
  // Legacy semantic aliases retained so route code stays readable.
  grid: "apps",
  list: "list-ul",
  folder: "layer-group",
  gear: "process",
  book: "shield-plus",
  clock: "clock",
  wrench: "key-skeleton",
  play: "rocket",
  pen: "document-layout-left",
  trash: "times-circle",
  plus: "plus-square",
  checkmark: "check",
};

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
  const active = activeNavKey(title);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · Jumpy Goat HQ</title>
  <link rel="stylesheet" href="/system.css">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <ul role="menu-bar" class="app-menu-bar" aria-label="Application menu">
    <li role="menu-item" aria-haspopup="false">Jumpy Goat HQ</li>
    <li role="menu-item" aria-haspopup="false">File</li>
    <li role="menu-item" aria-haspopup="false">Edit</li>
    <li role="menu-item" aria-haspopup="false">View</li>
  </ul>
  <div class="desktop-ornaments" aria-hidden="true">
    <span class="desktop-folder">Agents</span>
    <span class="desktop-folder">Boards</span>
    <span class="desktop-disk">Runs</span>
  </div>
  <div class="app-shell">
    <aside class="window sidebar">
      <div class="title-bar"><div class="title"><a class="brand-link" href="/" aria-label="Jumpy Goat HQ overview"><span class="apple" aria-hidden="true"></span>Jumpy Goat HQ</a></div></div>
      <div class="separator"></div>
      <div class="window-pane sidebar-pane">
        <nav class="sidebar-nav" aria-label="Primary navigation">
          ${navLink("overview", "/", iconLabel("overview", "Overview"), active, "root")}
          <details class="nav-group" open>
            <summary class="nav-group-label">Work</summary>
            <div class="nav-children">
              ${navLink("tasks", "/tasks", iconLabel("tasks", "Tasks"), active)}
              ${navLink("boards", "/boards", iconLabel("boards", "Boards"), active)}
            </div>
          </details>
          <details class="nav-group" open>
            <summary class="nav-group-label">Automations</summary>
            <div class="nav-children">
              ${navLink("automations", "/automations", iconLabel("automations", "All automations"), active)}
              ${navLink("schedule", "/schedule", iconLabel("schedule", "Schedule"), active)}
            </div>
          </details>
          <details class="nav-group" open>
            <summary class="nav-group-label">Agents</summary>
            <div class="nav-children">
              ${navLink("agents", "/agents", iconLabel("agents", "Agents"), active)}
            </div>
          </details>
          <details class="nav-group" open>
            <summary class="nav-group-label">Activity</summary>
            <div class="nav-children">
              ${navLink("runs", "/runs", iconLabel("runs", "Runs"), active)}
            </div>
          </details>
        </nav>
        <div class="sidebar-footer nav-children">
          ${navLink("settings", "/settings", iconLabel("settings", "Settings"), active)}
        </div>
      </div>
    </aside>
    <div class="content-shell">
      <main class="standard-dialog content-window">
        <div class="content-pane">
          ${body}
        </div>
      </main>
    </div>
  </div>
</body>
</html>`;
}

function navLink(key: string, href: string, label: string, active: string, extraClass = ""): string {
  const current = key === active;
  const classes = ["nav-link", extraClass, current ? "active" : ""].filter(Boolean).join(" ");
  return `<a class="${escapeHtml(classes)}" href="${escapeHtml(href)}"${current ? " aria-current=\"page\"" : ""}>${label}</a>`;
}

function activeNavKey(title: string): string {
  const normalized = title.toLowerCase();
  if (normalized === "dashboard" || normalized.includes("overview")) return "overview";
  if (normalized.includes("schedule")) return "schedule";
  if (normalized.includes("automation")) return "automations";
  if (normalized.includes("agent")) return "agents";
  if (normalized.includes("board")) return "boards";
  if (normalized.includes("project")) return "boards";
  if (normalized.includes("task")) return "tasks";
  if (normalized.includes("run")) return "runs";
  if (normalized.includes("settings")) return "settings";
  return "overview";
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

export function pageGrid(content: string, className = ""): string {
  return `<div class="${classAttr("page-grid", className)}">${content}</div>`;
}

export function panel(title: string, body: string, options: { icon?: string; actions?: string; className?: string } = {}): string {
  return `<article class="${classAttr("panel", options.className)}">${title || options.actions ? `<header class="panel-header">${title ? `<h3>${options.icon ? appIcon(options.icon) : ""}${escapeHtml(title)}</h3>` : ""}${options.actions ? `<div class="panel-actions">${options.actions}</div>` : ""}</header>` : ""}<div class="panel-body">${body}</div></article>`;
}

export function card(title: string, body: string, options: { icon?: string; actions?: string; className?: string; kicker?: string } = {}): string {
  return `<article class="${classAttr("card", options.className)}">${options.kicker ? `<p class="card-kicker">${escapeHtml(options.kicker)}</p>` : ""}<h3>${options.icon ? appIcon(options.icon) : ""}${escapeHtml(title)}</h3><div class="card-body">${body}</div>${options.actions ? `<div class="card-actions">${options.actions}</div>` : ""}</article>`;
}

export function folderCard(title: string, body: string, options: { icon?: string; actions?: string; className?: string; href?: string } = {}): string {
  const classes = classAttr("folder-card", options.className);
  const content = `<span class="folder-tab" aria-hidden="true"></span><div class="folder-card-content"><h3>${options.icon ? appIcon(options.icon) : ""}${escapeHtml(title)}</h3><div class="card-body">${body}</div>${options.actions ? `<div class="card-actions">${options.actions}</div>` : ""}</div>`;
  return options.href ? `<a class="${classes}" href="${escapeHtml(options.href)}">${content}</a>` : `<article class="${classes}">${content}</article>`;
}

export function formPanel(title: string, body: string, options: { icon?: string; className?: string } = {}): string {
  return panel(title, body, { icon: options.icon || "edit", className: classAttr("form-panel", options.className) });
}

export function actionLink(href: string, label: string, iconName?: string, className = "button-link"): string {
  return `<a href="${escapeHtml(href)}" class="${escapeHtml(className)}">${iconName ? appIcon(iconName) : ""}${escapeHtml(label)}</a>`;
}

export function notice(message: unknown, tone: "info" | "success" | "warning" | "error" = "info"): string {
  return `<p class="notice ${escapeHtml(tone)}">${escapeHtml(message)}</p>`;
}

export function badge(label: unknown, tone = ""): string {
  return `<span class="${classAttr("badge", tone)}">${escapeHtml(label)}</span>`;
}

export function emptyState(message: unknown, action = ""): string {
  return `<p class="empty-state">${appIcon("details")}${escapeHtml(message)}${action ? ` <span>${action}</span>` : ""}</p>`;
}

export function table(headers: TableCell[], rows: TableCell[][], options: { className?: string; empty?: string } = {}): string {
  if (rows.length === 0) return emptyState(options.empty || "No records found.");
  const classNames = ["responsive-table", options.className].filter(Boolean).join(" ");
  const classes = ` class="${escapeHtml(classNames)}"`;
  const labels = headers.map((header) => stripTags(renderCell(header)));
  return `<div class="table-wrap"><table${classes}><tr>${headers.map((header) => `<th>${renderCell(header)}</th>`).join("")}</tr>${rows.map((row) => `<tr>${row.map((cell, index) => `<td data-label="${escapeHtml(labels[index] || "")}">${renderCell(cell)}</td>`).join("")}</tr>`).join("")}</table></div>`;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

export function metaTable(rows: Array<[TableCell, TableCell]>): string {
  return `<div class="table-wrap"><table class="meta-table">${rows.map(([key, value]) => `<tr><th>${renderCell(key)}</th><td>${renderCell(value)}</td></tr>`).join("")}</table></div>`;
}

export function appIcon(name: string, label?: string): string {
  const iconName = uiIconMap[name] || name;
  const key = `${iconName}:${label || ""}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const filePath = new URL(`../public/icons/uim/${iconName}.svg`, import.meta.url);
  const title = label ? `<title>${escapeHtml(label)}</title>` : "";
  const svg = readFileSync(filePath, "utf8")
    .replace(/<svg\b/, `<svg class="app-icon icon" ${label ? `role="img" aria-label="${escapeHtml(label)}"` : "aria-hidden=\"true\""} focusable="false"`)
    .replace(/<svg([^>]*)>/, `<svg$1>${title}`);
  iconCache.set(key, svg);
  return svg;
}

export function icon(name: string): string {
  return appIcon(name);
}

export function iconLabel(iconName: string, label: string, options: { className?: string } = {}): string {
  return `<span class="${classAttr("icon-label", options.className)}">${appIcon(iconName)}<span>${escapeHtml(label)}</span></span>`;
}

export function status(value: string): string {
  const cls = value === "ok" ? "ok" : value === "running" ? "running" : "error";
  const label = cls === "ok" ? "Ok" : cls === "running" ? "Running" : "Needs review";
  return `<span class="status-badge status-${cls}" aria-label="Status: ${escapeHtml(label)}"><span class="status-dot" aria-hidden="true">●</span><span>${escapeHtml(value)}</span></span>`;
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
