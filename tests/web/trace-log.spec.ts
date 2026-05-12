import { expect, test } from "@playwright/test";

import { formatTraceLog } from "../../packages/web/src/trace-log";

const sampleTrace = [
  { type: "agenthq_run_meta", run_id: "01KR4B2H82ZWE7PKZ28SE1NR74", automation: "notification-noop", skill: "notification-review", schedule: "manual" },
  { type: "agenthq_pi_start", command: "pi", args: ["--mode", "json", "--no-session", "<prompt>"], cwd: "/tmp/workspace" },
  { type: "session", version: 3, id: "session-1", cwd: "/tmp/workspace" },
  { type: "message_start", message: { role: "user", content: [{ type: "text", text: "This is a notification smoke test. Produce a short FYI-only response." }] } },
  { type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "FY" } },
  { type: "message_update", assistantMessageEvent: { type: "text_delta", delta: "I" } },
  { type: "message_update", assistantMessageEvent: { type: "text_end", content: "FYI: no user-facing outcome was found.", partial: { responseId: "resp_1" } } },
  { type: "message_end", message: { role: "assistant", responseId: "resp_1", content: [{ type: "text", text: "FYI: no user-facing outcome was found." }], model: "gpt-5.5", usage: { input: 2532, output: 14, totalTokens: 2546, cost: { total: 0.01308 } } } },
  { type: "agenthq_summary", status: "ok", exitCode: 0, durationMs: 1200 },
].map((event) => JSON.stringify(event)).join("\n");

test("trace formatter compacts streaming deltas into readable entries", () => {
  const entries = formatTraceLog(sampleTrace);

  expect(entries.length).toBeLessThan(sampleTrace.split("\n").length);
  expect(entries.filter((entry) => entry.label === "Assistant output")).toHaveLength(1);
  expect(entries.find((entry) => entry.label === "Assistant output")?.detail).toBe("FYI: no user-facing outcome was found.");
  expect(entries.some((entry) => entry.detail === "FY")).toBe(false);
  expect(entries.some((entry) => entry.label === "Usage" && entry.detail?.includes("total: 2546"))).toBe(true);
});

test("trace formatter summarizes tool events without noisy updates", () => {
  const entries = formatTraceLog([
    JSON.stringify({ type: "tool_execution_start", toolName: "read", args: { path: "notes.md" } }),
    JSON.stringify({ type: "tool_execution_update", toolName: "read", partialResult: { content: [] } }),
    JSON.stringify({ type: "tool_execution_end", toolName: "read", result: { content: [{ type: "text", text: "done" }] } }),
  ].join("\n"));

  expect(entries.map((entry) => entry.label)).toEqual(["Tool started", "Tool finished"]);
});

test("trace formatter falls back for malformed and unknown lines", () => {
  const entries = formatTraceLog([
    "not-json",
    JSON.stringify({ type: "mystery_event", value: 123 }),
  ].join("\n"));

  expect(entries).toEqual([
    expect.objectContaining({ category: "raw", label: "Malformed trace line" }),
    expect.objectContaining({ category: "raw", label: "Unhandled event: mystery_event" }),
  ]);
});
