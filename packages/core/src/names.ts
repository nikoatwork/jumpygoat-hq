import { unsafeNameError } from "./errors.js";

export const SAFE_NAME = /^[a-z0-9][a-z0-9-]*$/;

export type ResourceNameKind = "agent" | "automation" | "board" | "task" | "project";

export function isSafeName(name: string): boolean {
  return SAFE_NAME.test(name);
}

export function assertSafeName(name: string, kind: ResourceNameKind = "agent"): void {
  if (!isSafeName(name)) throw unsafeNameError(`Invalid ${kind} name: ${name}`, kind === "task" ? "id" : "name");
}

export function assertAgentName(name: string): void {
  assertSafeName(name, "agent");
}

export function assertAutomationName(name: string): void {
  assertSafeName(name, "automation");
}

export function assertBoardName(name: string): void {
  assertSafeName(name, "board");
}

export const assertProjectName = assertBoardName;

export function assertTaskId(id: string): void {
  assertSafeName(id, "task");
}
