import { realpath, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { clampNumber, connectorSummary, errorMessage } from "../helpers.js";
import type { ConnectorRuntimeConfig, ConnectorToolDefinition, ConnectorToolResult } from "../types.js";
import { presignR2GetObject, putR2Object, readR2ConfigFromEnv } from "./r2.js";

type ArtifactUploadParams = {
  path: string;
  filename?: string;
  contentType?: string;
};

type ResolvedArtifactFile = {
  requested: string;
  absolutePath: string;
  realPath: string;
  root: "run" | "agent";
  bytes: number;
};

const DEFAULT_EXPIRES_SECONDS = 604800;
const DEFAULT_MAX_FILE_BYTES = 25_000_000;
const DEFAULT_TIMEOUT_MS = 60_000;

export function createArtifactTools(runtime: ConnectorRuntimeConfig): ConnectorToolDefinition[] {
  return [createArtifactUploadTool(runtime)];
}

function artifactDefaults(runtime: ConnectorRuntimeConfig): { expiresInSeconds: number; maxFileBytes: number; timeoutMs: number } {
  return {
    expiresInSeconds: clampNumber(runtime.artifacts?.expiresInSeconds ?? process.env.JUMPYGOATHQ_ARTIFACT_EXPIRES_SECONDS, DEFAULT_EXPIRES_SECONDS, 1, 604800),
    maxFileBytes: clampNumber(runtime.artifacts?.maxFileBytes ?? process.env.JUMPYGOATHQ_ARTIFACT_MAX_FILE_BYTES, DEFAULT_MAX_FILE_BYTES, 1, 1_000_000_000),
    timeoutMs: clampNumber(runtime.artifacts?.timeoutMs ?? process.env.JUMPYGOATHQ_ARTIFACT_UPLOAD_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1_000, 300_000),
  };
}

function createArtifactUploadTool(runtime: ConnectorRuntimeConfig): ConnectorToolDefinition<ArtifactUploadParams> {
  return {
    name: "artifact_upload",
    label: "Upload Artifact",
    description: "Upload a generated file to Cloudflare R2 and return a secret, expiring presigned download URL.",
    promptSnippet: "Upload a run artifact to Cloudflare R2 and use the returned URL in later messages/actions.",
    promptGuidelines: [
      "Use artifact_upload for files the automation produced and needs to share, such as PDFs or reports.",
      "Pass a relative file path from the run workspace or the active agent folder; absolute paths and path traversal are rejected.",
      "Use the returned URL instead of attaching large files to later email or webhook actions.",
    ],
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["path"],
      properties: {
        path: { type: "string", minLength: 1, description: "Relative path to the file in the run workspace or active agent folder, for example output/report.pdf." },
        filename: { type: "string", minLength: 1, description: "Optional download/object filename. Defaults to the source basename." },
        contentType: { type: "string", minLength: 1, description: "Optional MIME type, for example application/pdf. Guessed from filename when omitted." },
      },
    },
    async execute(toolCallId, params, signal) {
      const startedAt = new Date().toISOString();
      const requestedPath = String(params.path || "").trim();
      const defaults = artifactDefaults(runtime);
      let filename = "";
      try {
        const file = await resolveArtifactFile(runtime, requestedPath, defaults.maxFileBytes);
        filename = safeFilename(params.filename || path.basename(file.requested));
        const contentType = normalizeContentType(params.contentType) || guessContentType(filename);
        const key = `runs/${safeKeyPart(runtime.runId)}/${filename}`;
        const body = await readFile(file.realPath);
        const config = readR2ConfigFromEnv();

        await putR2Object(config, { key, body, contentType, timeoutMs: defaults.timeoutMs, signal });
        const url = presignR2GetObject(config, key, defaults.expiresInSeconds);
        const expiresAt = new Date(Date.now() + defaults.expiresInSeconds * 1000).toISOString();
        const finishedAt = new Date().toISOString();
        const summary = connectorSummary({
          runId: runtime.runId,
          automation: runtime.automationName,
          agent: runtime.agentName,
          toolCallId,
          intent: "artifact.upload",
          toolName: "artifact_upload",
          connector: "r2",
          status: "succeeded",
          startedAt,
          finishedAt,
          url,
          artifactKey: key,
          filename,
          bytes: file.bytes,
          expiresAt,
          resultSummary: { key, filename, bytes: file.bytes, contentType, expiresInSeconds: defaults.expiresInSeconds, sourceRoot: file.root },
        });
        return {
          content: [{ type: "text", text: `artifact_upload succeeded: ${filename} (${file.bytes} bytes) uploaded to ${key}. Download URL expires at ${expiresAt}:\n${url}` }],
          details: { connectorSummary: summary, artifact: { key, url, expiresAt, filename, bytes: file.bytes, contentType } },
        };
      } catch (error) {
        return artifactFailureResult({ runtime, toolCallId, startedAt, requestedPath, filename, error });
      }
    },
  };
}

async function resolveArtifactFile(runtime: ConnectorRuntimeConfig, requested: string, maxFileBytes: number): Promise<ResolvedArtifactFile> {
  const normalized = validateRelativeArtifactPath(requested);
  const roots: Array<{ root: "run" | "agent"; dir: string }> = [{ root: "run", dir: process.cwd() }];
  if (runtime.artifacts?.agentDir) roots.push({ root: "agent", dir: runtime.artifacts.agentDir });

  const checked: string[] = [];
  for (const candidate of roots) {
    const rootReal = await realpath(candidate.dir).catch(() => undefined);
    if (!rootReal) continue;
    const absolutePath = path.resolve(rootReal, normalized);
    checked.push(absolutePath);
    let realFilePath: string;
    try {
      realFilePath = await realpath(absolutePath);
    } catch {
      continue;
    }
    if (!isInside(realFilePath, rootReal)) throw new Error(`Artifact path resolves outside the ${candidate.root} folder: ${normalized}`);
    const info = await stat(realFilePath);
    if (!info.isFile()) throw new Error(`Artifact path is not a file: ${normalized}`);
    if (info.size > maxFileBytes) throw new Error(`Artifact file is too large: ${info.size} bytes exceeds maxFileBytes ${maxFileBytes}.`);
    return { requested: normalized, absolutePath, realPath: realFilePath, root: candidate.root, bytes: info.size };
  }
  throw new Error(`Artifact file not found: ${normalized}${checked.length ? ` (checked ${checked.join(", ")})` : ""}`);
}

function validateRelativeArtifactPath(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) throw new Error("artifact_upload path is required.");
  if (trimmed.includes("\0")) throw new Error("artifact_upload path contains an invalid null byte.");
  if (trimmed.includes("\\")) throw new Error("artifact_upload path must use forward slashes.");
  if (path.isAbsolute(trimmed) || /^[a-zA-Z]:\//.test(trimmed)) throw new Error("artifact_upload path must be relative.");
  const normalized = path.posix.normalize(trimmed);
  if (normalized !== trimmed || normalized.startsWith("../") || normalized.includes("/../") || normalized === "..") {
    throw new Error("artifact_upload path must not contain path traversal.");
  }
  return normalized;
}

function isInside(childPath: string, parentPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return relative === "" || (!!relative && !relative.startsWith("..") && !path.isAbsolute(relative));
}

function safeFilename(value: string): string {
  const trimmed = String(value || "").trim();
  const basename = path.posix.basename(trimmed.replace(/\\/g, "/"));
  const safe = basename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
  if (!safe || safe === "." || safe === "..") throw new Error("artifact_upload filename is invalid.");
  return safe;
}

function safeKeyPart(value: string): string {
  return String(value || "run").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120) || "run";
}

function normalizeContentType(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(?:\s*;\s*[a-z0-9!#$&^_.+-]+=.+)?$/i.test(trimmed)) {
    throw new Error(`Invalid contentType: ${trimmed}`);
  }
  return trimmed;
}

function guessContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".html" || ext === ".htm") return "text/html; charset=utf-8";
  if (ext === ".txt" || ext === ".md") return "text/plain; charset=utf-8";
  if (ext === ".json") return "application/json";
  if (ext === ".csv") return "text/csv; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function artifactFailureResult(args: {
  runtime: ConnectorRuntimeConfig;
  toolCallId: string;
  startedAt: string;
  requestedPath: string;
  filename?: string;
  error: unknown;
}): ConnectorToolResult {
  const message = errorMessage(args.error);
  const finishedAt = new Date().toISOString();
  const summary = connectorSummary({
    runId: args.runtime.runId,
    automation: args.runtime.automationName,
    agent: args.runtime.agentName,
    toolCallId: args.toolCallId,
    intent: "artifact.upload",
    toolName: "artifact_upload",
    connector: "r2",
    status: "failed",
    startedAt: args.startedAt,
    finishedAt,
    filename: args.filename,
    error: message,
    resultSummary: { path: args.requestedPath || undefined },
  });
  return { content: [{ type: "text", text: `artifact_upload failed: ${message}` }], details: { connectorSummary: summary } };
}
