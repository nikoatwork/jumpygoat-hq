export type RunLog = {
  traceLines: string[];
  outputChunks: string[];
  errorLines: string[];
};

export function createRunLog(): RunLog {
  return { traceLines: [], outputChunks: [], errorLines: [] };
}

export function pushTraceLine(log: RunLog, value: unknown): void {
  log.traceLines.push(typeof value === "string" ? value : JSON.stringify(value));
}

export function pushOutputFromPiEvent(log: RunLog, event: unknown): void {
  if (!event || typeof event !== "object") return;
  const maybe = event as { type?: unknown; assistantMessageEvent?: { type?: unknown; delta?: unknown } };
  if (maybe.type === "message_update" && maybe.assistantMessageEvent?.type === "text_delta") {
    if (typeof maybe.assistantMessageEvent.delta === "string") log.outputChunks.push(maybe.assistantMessageEvent.delta);
  }
}

export function traceText(log: RunLog): string {
  return log.traceLines.join("\n");
}

export function outputText(log: RunLog): string {
  return log.outputChunks.join("");
}

export function errorText(log: RunLog): string {
  return log.errorLines.join("\n");
}
