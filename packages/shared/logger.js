import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { dataDir, jumpyGoatHqHome } from "./paths.js";

const LEVELS = Object.freeze({ debug: 10, info: 20, warn: 30, error: 40 });
const SECRET_KEY_PATTERN = /(token|secret|password|passwd|authorization|api[-_]?key|cookie|session|credential|env)/i;
const MAX_STRING_LENGTH = 2000;
const MAX_ARRAY_LENGTH = 50;
const MAX_OBJECT_KEYS = 80;

export function logDir() {
  const configured = process.env.JUMPYGOATHQ_LOG_DIR?.trim();
  if (!configured) return path.join(dataDir(), "logs");
  return path.isAbsolute(configured) ? configured : path.join(jumpyGoatHqHome(), configured);
}

export function createLogger(options) {
  const component = options.component;
  const file = options.file || `${component}.jsonl`;
  const echo = options.console !== false;
  return {
    debug(event, details) {
      writeLog({ level: "debug", component, event, details, file, echo });
    },
    info(event, details) {
      writeLog({ level: "info", component, event, details, file, echo });
    },
    warn(event, details) {
      writeLog({ level: "warn", component, event, details, file, echo });
    },
    error(event, details) {
      writeLog({ level: "error", component, event, details, file, echo });
    },
  };
}

export function sanitizeLogDetails(value) {
  return sanitizeValue(value, 0, "");
}

function writeLog(entry) {
  if (!shouldLog(entry.level)) return;
  const safeDetails = sanitizeLogDetails(entry.details || {});
  const record = {
    ts: new Date().toISOString(),
    level: entry.level,
    component: entry.component,
    event: entry.event,
    ...safeDetails,
  };
  appendJsonLine(entry.file, record);
  if (entry.level === "error" && entry.file !== "errors.jsonl") appendJsonLine("errors.jsonl", record);
  if (entry.echo) echoRecord(record);
}

function shouldLog(level) {
  const configured = String(process.env.JUMPYGOATHQ_LOG_LEVEL || "info").toLowerCase();
  const threshold = LEVELS[configured] || LEVELS.info;
  return LEVELS[level] >= threshold;
}

function appendJsonLine(file, record) {
  try {
    const dir = logDir();
    mkdirSync(dir, { recursive: true });
    appendFileSync(path.join(dir, file), `${JSON.stringify(record)}\n`, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[log:error] failed to write ${file}: ${message}`);
  }
}

function echoRecord(record) {
  const { ts, level, component, event, message, ...rest } = record;
  const suffix = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : "";
  const text = `[${ts}] ${level} ${component} ${event}${message ? ` ${message}` : ""}${suffix}`;
  if (level === "error") console.error(text);
  else if (level === "warn") console.warn(text);
  else console.log(text);
}

function sanitizeValue(value, depth, key) {
  if (SECRET_KEY_PATTERN.test(key)) return "[redacted]";
  if (value == null) return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: truncateString(value.stack || ""),
    };
  }
  if (typeof value === "string") return truncateString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "symbol" || typeof value === "function") return String(value);
  if (Array.isArray(value)) {
    if (depth >= 4) return `[array:${value.length}]`;
    const items = value.slice(0, MAX_ARRAY_LENGTH).map((item) => sanitizeValue(item, depth + 1, key));
    if (value.length > MAX_ARRAY_LENGTH) items.push(`[${value.length - MAX_ARRAY_LENGTH} more items]`);
    return items;
  }
  if (typeof value === "object") {
    if (depth >= 4) return "[object]";
    const out = {};
    const entries = Object.entries(value).slice(0, MAX_OBJECT_KEYS);
    for (const [childKey, childValue] of entries) out[childKey] = sanitizeValue(childValue, depth + 1, childKey);
    const extraKeys = Object.keys(value).length - entries.length;
    if (extraKeys > 0) out.__truncated_keys = extraKeys;
    return out;
  }
  return String(value);
}

function truncateString(value) {
  if (value.length <= MAX_STRING_LENGTH) return value;
  return `${value.slice(0, MAX_STRING_LENGTH)}…[truncated ${value.length - MAX_STRING_LENGTH} chars]`;
}
