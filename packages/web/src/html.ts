import type { RunRow } from "./readers.js";

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
  <title>${escapeHtml(title)} · agenthq</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1100px; margin: 2rem auto; padding: 0 1rem; line-height: 1.4; }
    nav a { margin-right: 1rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.4rem; vertical-align: top; }
    th { text-align: left; background: #f7f7f7; }
    pre { background: #f7f7f7; padding: 1rem; overflow: auto; }
    code { background: #f7f7f7; padding: 0.1rem 0.2rem; }
    .ok { color: green; } .error { color: #b00020; } .running { color: #9a6700; }
    .muted { color: #666; }
    .stack label { display: block; margin: 0.8rem 0; font-weight: 600; }
    input, select, textarea { box-sizing: border-box; width: 100%; max-width: 100%; padding: 0.4rem; font: inherit; }
    textarea { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    td.actions form { display: inline; }
    td.actions details { margin-top: 0.4rem; }
    button { cursor: pointer; }
  </style>
</head>
<body>
  <h1>agenthq</h1>
  <nav><a href="/">Dashboard</a><a href="/automations">Automations</a><a href="/skills">Skills</a><a href="/runs">Runs</a></nav>
  <hr>
  ${body}
</body>
</html>`;
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
