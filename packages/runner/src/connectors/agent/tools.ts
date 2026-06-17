import { existsSync } from "node:fs";
import { ulid } from "ulid";
import type { InvocationExecutionResult } from "../../execute.js";
import { invocationFromSubagent, type Invocation } from "../../invocation.js";
import { agentPath } from "../../paths.js";
import { clampNumber, connectorSummary, errorMessage, truncateText } from "../helpers.js";
import type { ConnectorRuntimeConfig, ConnectorToolDefinition, ConnectorToolResult } from "../types.js";

type AgentInvokeParams = {
  agent: string;
  prompt: string;
  model?: string;
  maxOutputChars?: number;
};

type AgentInvokeDefaults = {
  allow: string[];
  timeoutMs: number;
  maxDepth: number;
  maxOutputChars: number;
};

type AgentInvokeExecutor = (invocation: Invocation, options: { runId: string; label: string; silent: boolean; timeoutMs: number }) => Promise<InvocationExecutionResult>;

const SAFE_AGENT_NAME = /^[a-z0-9-]+$/;

export function createAgentInvokeTools(runtime: ConnectorRuntimeConfig, executor?: AgentInvokeExecutor): ConnectorToolDefinition[] {
  return [createAgentInvokeTool(runtime, executor)];
}

function agentInvokeDefaults(runtime: ConnectorRuntimeConfig): AgentInvokeDefaults {
  return {
    allow: runtime.agentInvoke?.allow ?? [],
    timeoutMs: runtime.agentInvoke?.timeoutMs ?? 10 * 60_000,
    maxDepth: runtime.agentInvoke?.maxDepth ?? 1,
    maxOutputChars: runtime.agentInvoke?.maxOutputChars ?? 12_000,
  };
}

function createAgentInvokeTool(runtime: ConnectorRuntimeConfig, executor?: AgentInvokeExecutor): ConnectorToolDefinition<AgentInvokeParams> {
  return {
    name: "agent_invoke",
    label: "Invoke Agent",
    description: "Synchronously invoke an allowlisted jumpyGoatHq child agent and return a bounded result.",
    promptSnippet: "Invoke an allowlisted child jumpyGoatHq agent, wait for completion, and use its bounded output as context.",
    promptGuidelines: [
      "Use agent_invoke only for subtasks that are better handled by the target child agent's instructions and context.",
      "Provide a specific delegated prompt; the child agent runs as its own jumpyGoatHq invocation and resolves its own permissions.",
      "Use the returned child run id for auditability; do not assume raw child trace is included.",
    ],
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["agent", "prompt"],
      properties: {
        agent: { type: "string", minLength: 1, description: "Allowlisted target agent name." },
        prompt: { type: "string", minLength: 1, description: "Delegated subtask prompt for the child agent." },
        model: { type: "string", minLength: 1, description: "Optional model override for the child invocation." },
        maxOutputChars: { type: "number", minimum: 1000, maximum: 50000, description: "Optional bound for returned child output." },
      },
    },
    async execute(toolCallId, params) {
      const startedAt = new Date().toISOString();
      const defaults = agentInvokeDefaults(runtime);
      const maxOutputChars = clampNumber(params.maxOutputChars, defaults.maxOutputChars, 1_000, 50_000);
      const targetAgent = String(params.agent || "").trim();
      const prompt = String(params.prompt || "").trim();

      try {
        validateAgentInvokeRequest({ runtime, defaults, targetAgent, prompt });
        const childRunId = ulid();
        const rootRunId = runtime.rootRunId || runtime.runId;
        const childDepth = (runtime.depth ?? 0) + 1;
        const invocation = invocationFromSubagent({
          childRunId,
          parentRunId: runtime.runId,
          rootRunId,
          parentAgent: runtime.agentName,
          targetAgent,
          prompt,
          model: typeof params.model === "string" && params.model.trim() ? params.model.trim() : undefined,
          depth: childDepth,
        });

        const executeChild = executor ?? (await defaultExecutor());
        const result = await withConsoleSilenced(() => executeChild(invocation, {
          runId: childRunId,
          label: "jumpyGoatHq subagent run",
          silent: true,
          timeoutMs: defaults.timeoutMs,
        }));
        const formatted = formatAgentInvokeResult({ targetAgent, result, maxOutputChars });
        const finishedAt = new Date().toISOString();
        const status = result.status === "ok" ? "succeeded" : result.timedOut ? "failed_timeout" : "failed";
        const summary = connectorSummary({
          runId: runtime.runId,
          automation: runtime.automationName,
          agent: runtime.agentName,
          toolCallId,
          intent: "agent.invoke",
          toolName: "agent_invoke",
          connector: "jumpygoathq",
          status,
          startedAt,
          finishedAt,
          resultSummary: {
            targetAgent,
            childRunId: result.runId,
            childStatus: result.status,
            childExitCode: result.exitCode,
            childSignal: result.signal,
            timedOut: result.timedOut === true,
            depth: childDepth,
            maxDepth: defaults.maxDepth,
            durationMs: result.durationMs,
            outputChars: result.outputText.length,
            errorChars: result.errorText.length,
            truncated: formatted.truncated,
          },
          error: result.status === "ok" ? undefined : result.errorText.slice(-1000) || `Child agent exited with ${result.exitCode ?? "unknown"}.`,
        });
        return { content: [{ type: "text", text: formatted.text }], details: { connectorSummary: summary } };
      } catch (error) {
        return agentInvokeFailureResult({ runtime, toolCallId, startedAt, targetAgent, error });
      }
    },
  };
}

async function defaultExecutor(): Promise<AgentInvokeExecutor> {
  const { executeInvocation } = await import("../../execute.js");
  return executeInvocation;
}

async function withConsoleSilenced<T>(fn: () => Promise<T>): Promise<T> {
  const original = { log: console.log, warn: console.warn, error: console.error };
  console.log = () => undefined;
  console.warn = () => undefined;
  console.error = () => undefined;
  try {
    return await fn();
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }
}

function validateAgentInvokeRequest(args: {
  runtime: ConnectorRuntimeConfig;
  defaults: AgentInvokeDefaults;
  targetAgent: string;
  prompt: string;
}): void {
  if (!args.targetAgent || !SAFE_AGENT_NAME.test(args.targetAgent)) throw new Error(`Invalid target agent name: ${args.targetAgent || "empty"}.`);
  if (!args.prompt) throw new Error("agent_invoke prompt is required.");
  if (!args.defaults.allow.includes(args.targetAgent)) throw new Error(`Target agent is not allowlisted: ${args.targetAgent}.`);
  if (args.targetAgent === args.runtime.agentName) throw new Error(`Self-invocation is not allowed by default: ${args.targetAgent}.`);
  const currentDepth = args.runtime.depth ?? 0;
  if (currentDepth >= args.defaults.maxDepth) throw new Error(`agent.invoke maxDepth exceeded: current depth ${currentDepth}, max ${args.defaults.maxDepth}.`);
  if (!existsSync(agentPath(args.targetAgent))) throw new Error(`Target agent not found: ${args.targetAgent}.`);
}

function formatAgentInvokeResult(args: {
  targetAgent: string;
  result: InvocationExecutionResult;
  maxOutputChars: number;
}): { text: string; truncated: boolean } {
  const sections = [
    `agent_invoke ${args.result.status === "ok" ? "succeeded" : "failed"}: ${args.targetAgent}`,
    `Child run: ${args.result.runId}`,
    `Status: ${args.result.status}${args.result.timedOut ? " (timed out)" : ""}`,
    `Duration: ${args.result.durationMs}ms`,
  ];
  if (args.result.outputText.trim()) sections.push(`OUTPUT:\n${args.result.outputText.trimEnd()}`);
  if (args.result.errorText.trim()) sections.push(`ERROR:\n${args.result.errorText.trimEnd().slice(-4000)}`);
  const truncated = truncateText(sections.join("\n\n"), args.maxOutputChars);
  return { text: truncated.text, truncated: truncated.truncated };
}

function agentInvokeFailureResult(args: {
  runtime: ConnectorRuntimeConfig;
  toolCallId: string;
  startedAt: string;
  targetAgent: string;
  error: unknown;
}): ConnectorToolResult {
  const message = errorMessage(args.error);
  const finishedAt = new Date().toISOString();
  const status = message.includes("maxDepth") ? "failed_max_depth" : message.includes("not allowlisted") || message.includes("Self-invocation") ? "failed_not_allowed" : "failed";
  const summary = connectorSummary({
    runId: args.runtime.runId,
    automation: args.runtime.automationName,
    agent: args.runtime.agentName,
    toolCallId: args.toolCallId,
    intent: "agent.invoke",
    toolName: "agent_invoke",
    connector: "jumpygoathq",
    status,
    startedAt: args.startedAt,
    finishedAt,
    resultSummary: {
      targetAgent: args.targetAgent,
      depth: args.runtime.depth ?? 0,
      maxDepth: args.runtime.agentInvoke?.maxDepth ?? 1,
    },
    error: message,
  });
  return { content: [{ type: "text", text: `agent_invoke failed: ${message}` }], details: { connectorSummary: summary } };
}
