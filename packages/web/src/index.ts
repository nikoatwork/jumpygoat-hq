#!/usr/bin/env node
import http from "node:http";
import { loadDotEnv } from "./env.js";
import { route } from "./routes.js";
import type { RequestBody } from "./api.js";
import { dbPath, jumpyGoatHqHome } from "./paths.js";
import { createLogger } from "../../shared/logger.js";

loadDotEnv();

const webLogger = createLogger({ component: "web", file: "web.jsonl" });

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || "3000");

const server = http.createServer((req, res) => {
  const started = Date.now();
  void handle(req, res).finally(() => {
    const ms = Date.now() - started;
    const url = safeRequestUrl(req);
    webLogger.info("request", {
      method: req.method || "",
      path: url.pathname,
      route_type: url.pathname.startsWith("/api") ? "api" : "page",
      status: res.statusCode,
      duration_ms: ms,
    });
  });
});

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const method = req.method || "GET";
  const url = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);
  const response = await responseForRequest(method, url, req);
  res.statusCode = response.status;
  for (const [key, value] of Object.entries(response.headers || {})) res.setHeader(key, value);
  if (!res.hasHeader("content-type") && response.body) res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(response.body);
}

async function responseForRequest(method: string, url: URL, req: http.IncomingMessage) {
  try {
    const body = shouldReadBody(method) ? await readRequestBody(req) : undefined;
    return await route(method, url, body ? { ...body, headers: req.headers } : { headers: req.headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    webLogger.error("request_error", {
      method,
      path: url.pathname,
      route_type: url.pathname.startsWith("/api") ? "api" : "page",
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (url.pathname.startsWith("/api")) {
      const syntax = error instanceof SyntaxError;
      return {
        status: syntax ? 400 : 500,
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ code: syntax ? "INVALID_JSON" : "INTERNAL_ERROR", message: syntax ? "Invalid JSON request body." : message }),
      };
    }
    return { status: 500, headers: { "content-type": "text/html; charset=utf-8" }, body: `<h1>Error</h1><pre>${escapeHtml(message)}</pre>` };
  }
}

function shouldReadBody(method: string): boolean {
  return !["GET", "HEAD"].includes(method.toUpperCase());
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

function safeRequestUrl(req: http.IncomingMessage): URL {
  return new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);
}

async function readRequestBody(req: http.IncomingMessage): Promise<RequestBody> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (contentType.includes("application/json")) {
    return { raw, json: raw.trim() ? JSON.parse(raw) : undefined };
  }
  return { raw, form: new URLSearchParams(raw) };
}

server.listen(port, host, () => {
  webLogger.info("startup", {
    host,
    port,
    db_path: dbPath(),
    instance_home: jumpyGoatHqHome(),
    node_version: process.version,
    pid: process.pid,
  });
  if (host === "0.0.0.0") webLogger.warn("public_bind", { message: "Bound to 0.0.0.0. Put this behind trusted auth/proxy/firewall." });
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    webLogger.info("shutdown_signal", { signal, pid: process.pid });
    server.close(() => {
      webLogger.info("shutdown_complete", { signal, pid: process.pid });
      process.exit(0);
    });
  });
}

process.on("uncaughtException", (error) => {
  webLogger.error("uncaught_exception", { message: error.message, stack: error.stack, pid: process.pid });
  setImmediate(() => process.exit(1));
});

process.on("unhandledRejection", (reason) => {
  webLogger.error("unhandled_rejection", {
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    pid: process.pid,
  });
  setImmediate(() => process.exit(1));
});
