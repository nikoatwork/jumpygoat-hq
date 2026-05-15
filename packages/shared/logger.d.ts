export type LogLevel = "debug" | "info" | "warn" | "error";

export type Logger = {
  debug(event: string, details?: Record<string, unknown>): void;
  info(event: string, details?: Record<string, unknown>): void;
  warn(event: string, details?: Record<string, unknown>): void;
  error(event: string, details?: Record<string, unknown>): void;
};

export function logDir(): string;
export function createLogger(options: { component: string; file?: string; console?: boolean }): Logger;
export function sanitizeLogDetails(value: unknown): unknown;
