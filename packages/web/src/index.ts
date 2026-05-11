#!/usr/bin/env node
import http from "node:http";
import { loadDotEnv } from "./env.js";
import { route } from "./routes.js";
import { dbPath } from "./paths.js";

loadDotEnv();

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || "3000");

const server = http.createServer((req, res) => {
  const started = Date.now();
  void handle(req, res).finally(() => {
    const ms = Date.now() - started;
    console.log(`${req.method || ""} ${req.url || ""} ${res.statusCode} ${ms}ms`);
  });
});

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const method = req.method || "GET";
  const url = new URL(req.url || "/", `http://${req.headers.host || `${host}:${port}`}`);
  const form = method === "POST" ? await readForm(req) : undefined;
  const response = await route(method, url, form);
  res.statusCode = response.status;
  for (const [key, value] of Object.entries(response.headers || {})) res.setHeader(key, value);
  if (!res.hasHeader("content-type") && response.body) res.setHeader("content-type", "text/html; charset=utf-8");
  res.end(response.body);
}

async function readForm(req: http.IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const body = Buffer.concat(chunks).toString("utf8");
  return new URLSearchParams(body);
}

server.listen(port, host, () => {
  console.log(`jumpyGoat web listening on http://${host}:${port}`);
  console.log(`db: ${dbPath()}`);
  if (host === "0.0.0.0") console.warn("WARNING: bound to 0.0.0.0. Put this behind trusted auth/proxy/firewall.");
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    console.log(`received ${signal}, shutting down`);
    server.close(() => process.exit(0));
  });
}
