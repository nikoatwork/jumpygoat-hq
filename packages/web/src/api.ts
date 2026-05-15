import {
  CoreError,
  createAgent,
  createAutomation,
  createBoard,
  createTask,
  deleteAgent,
  deleteAutomation,
  deleteBoard,
  deleteTask,
  getAgent,
  getAutomation,
  getBoard,
  getCronStatus,
  getRun,
  getSettings,
  getTask,
  installAutomationCron,
  installTaskHeartbeatCron,
  listAgents,
  listAutomations,
  listBoards,
  listRuns,
  listTasks,
  runAutomationNow,
  uninstallAutomationCron,
  uninstallTaskHeartbeatCron,
  updateAgent,
  updateAutomation,
  updateBoard,
  updateSettings,
  updateTask,
  updateTaskStatus,
  type AgentCreateInput,
  type AutomationCreateInput,
  type BoardCreateInput,
  type CronInstallInput,
  type TaskCreateInput,
  type TaskPriority,
  type TaskStatus,
} from "@jumpygoat-hq/core";
import type { ResponseData } from "./routes.js";

export type RequestBody = {
  form?: URLSearchParams;
  json?: unknown;
  raw?: string;
  headers?: Record<string, string | string[] | undefined>;
};

export async function apiRoute(method: string, url: URL, body: RequestBody = {}): Promise<ResponseData | undefined> {
  if (!url.pathname.startsWith("/api")) return undefined;

  const authError = authorizeApiRequest(body);
  if (authError) return authError;

  try {
    const path = url.pathname.replace(/\/+$/, "") || "/api";

    if (method === "GET" && path === "/api") return json({ ok: true, name: "jumpyGoatHQ API" });

    if (path === "/api/agents") {
      if (method === "GET") return json({ agents: await listAgents({ includeRaw: url.searchParams.get("raw") === "1" }) });
      if (method === "POST") return json({ agent: await createAgent(agentInput(readObject(body))) }, 201);
    }

    const agentMatch = path.match(/^\/api\/agents\/([a-z0-9-]+)$/);
    if (agentMatch) {
      const name = decodeURIComponent(agentMatch[1]!);
      if (method === "GET") return json({ agent: await getAgent(name, { includeRaw: url.searchParams.get("raw") === "1" }) });
      if (method === "PUT") return json(await upsertAgentResponse(name, agentUpdateInput(name, readObject(body))));
      if (method === "DELETE") {
        await deleteAgent(name);
        return json({ ok: true });
      }
    }

    if (path === "/api/automations") {
      if (method === "GET") return json({ automations: await listAutomations({ includeRaw: url.searchParams.get("raw") === "1" }) });
      if (method === "POST") return json({ automation: await createAutomation(automationInput(readObject(body))) }, 201);
    }

    const automationRunMatch = path.match(/^\/api\/automations\/([a-z0-9-]+)\/runs$/);
    if (automationRunMatch && method === "POST") {
      const name = decodeURIComponent(automationRunMatch[1]!);
      auditApiSideEffect(method, path, { automation: name });
      return json({ run: await runAutomationNow(name) }, 202);
    }

    const automationStatusMatch = path.match(/^\/api\/automations\/([a-z0-9-]+)\/status$/);
    if (automationStatusMatch && method === "GET") {
      const name = decodeURIComponent(automationStatusMatch[1]!);
      return json({ status: await automationStatusResponse(name, optionalNumber(url.searchParams.get("limit"))) });
    }

    const automationMatch = path.match(/^\/api\/automations\/([a-z0-9-]+)$/);
    if (automationMatch) {
      const name = decodeURIComponent(automationMatch[1]!);
      if (method === "GET") return json({ automation: await getAutomation(name, { includeRaw: url.searchParams.get("raw") === "1" }) });
      if (method === "PUT") return json(await upsertAutomationResponse(name, automationInput(readObject(body), name)));
      if (method === "DELETE") {
        await deleteAutomation(name);
        return json({ ok: true });
      }
    }

    if (path === "/api/boards") {
      if (method === "GET") return json({ boards: await listBoards({ includeRaw: url.searchParams.get("raw") === "1" }) });
      if (method === "POST") return json({ board: await createBoard(boardInput(readObject(body))) }, 201);
    }

    const boardTaskStatusMatch = path.match(/^\/api\/boards\/([a-z0-9-]+)\/tasks\/([a-z0-9-]+)\/status$/);
    if (boardTaskStatusMatch && method === "PATCH") {
      const input = readObject(body);
      return json({ task: await updateTaskStatus(decodeURIComponent(boardTaskStatusMatch[1]!), decodeURIComponent(boardTaskStatusMatch[2]!), { status: stringValue(input.status, "status") as TaskStatus }) });
    }

    const boardTaskMatch = path.match(/^\/api\/boards\/([a-z0-9-]+)\/tasks\/([a-z0-9-]+)$/);
    if (boardTaskMatch) {
      const board = decodeURIComponent(boardTaskMatch[1]!);
      const task = decodeURIComponent(boardTaskMatch[2]!);
      if (method === "GET") return json({ task: await getTask(board, task, { includeRaw: url.searchParams.get("raw") === "1" }) });
      if (method === "PUT") return json({ task: await updateTask(board, task, taskUpdateInput(readObject(body), board, task)) });
      if (method === "DELETE") {
        await deleteTask(board, task);
        return json({ ok: true });
      }
    }

    const boardMatch = path.match(/^\/api\/boards\/([a-z0-9-]+)$/);
    if (boardMatch) {
      const id = decodeURIComponent(boardMatch[1]!);
      if (method === "GET") return json({ board: await getBoard(id, { includeRaw: url.searchParams.get("raw") === "1" }) });
      if (method === "PUT") return json({ board: await updateBoard(id, boardInput(readObject(body), id)) });
      if (method === "DELETE") {
        await deleteBoard(id);
        return json({ ok: true });
      }
    }

    if (path === "/api/tasks") {
      if (method === "GET") return json({ tasks: await listTasks({ board: optionalString(url.searchParams.get("board")), status: optionalString(url.searchParams.get("status")) as TaskStatus | undefined }) });
      if (method === "POST") return json({ task: await createTask(taskInput(readObject(body))) }, 201);
    }

    if (path === "/api/runs" && method === "GET") {
      return json({ runs: await listRuns({ limit: optionalNumber(url.searchParams.get("limit")), sourceType: optionalString(url.searchParams.get("sourceType")), sourceId: optionalString(url.searchParams.get("sourceId")), automation: optionalString(url.searchParams.get("automation")), agent: optionalString(url.searchParams.get("agent")), board: optionalString(url.searchParams.get("board")), taskId: optionalString(url.searchParams.get("taskId")) }) });
    }

    const runMatch = path.match(/^\/api\/runs\/([^/]+)$/);
    if (runMatch && method === "GET") return json({ run: await getRun(decodeURIComponent(runMatch[1]!)) });

    if (path === "/api/settings") {
      if (method === "GET") return json({ settings: await getSettings() });
      if (method === "PUT") return json({ settings: await updateSettings({ content: stringValue(readObject(body).content, "content") }) });
    }

    if (path === "/api/setup/automation" && method === "POST") {
      return json(await setupAutomationResponse(readObject(body)));
    }

    if (path === "/api/cron" && method === "GET") return json({ cron: await getCronStatus() });

    if (path === "/api/cron/automations") {
      const input = readObject(body);
      const name = stringValue(input.name, "name");
      if (method === "PUT") {
        auditApiSideEffect(method, path, { automation: name });
        return json({ result: await installAutomationCron(name) });
      }
      if (method === "DELETE") {
        auditApiSideEffect(method, path, { automation: name });
        return json({ result: await uninstallAutomationCron(name) });
      }
    }

    const cronAutomationMatch = path.match(/^\/api\/cron\/automations\/([a-z0-9-]+)$/);
    if (cronAutomationMatch) {
      const name = decodeURIComponent(cronAutomationMatch[1]!);
      if (method === "PUT") {
        auditApiSideEffect(method, path, { automation: name });
        return json({ result: await installAutomationCron(name) });
      }
      if (method === "DELETE") {
        auditApiSideEffect(method, path, { automation: name });
        return json({ result: await uninstallAutomationCron(name) });
      }
    }

    if (path === "/api/cron/task-heartbeat") {
      if (method === "PUT") {
        const input = cronInstallInput(readObject(body, true));
        auditApiSideEffect(method, path, input);
        return json({ result: await installTaskHeartbeatCron(input) });
      }
      if (method === "DELETE") {
        auditApiSideEffect(method, path);
        return json({ result: await uninstallTaskHeartbeatCron() });
      }
    }

    return json({ code: "NOT_FOUND", message: "API route not found." }, 404);
  } catch (error) {
    return errorJson(error);
  }
}

function json(value: unknown, status = 200): ResponseData {
  return { status, headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(value) };
}

function authorizeApiRequest(body: RequestBody): ResponseData | undefined {
  const expected = process.env.JUMPYGOATHQ_API_TOKEN?.trim();
  if (!expected) return undefined;
  const token = bearerToken(body.headers?.authorization) || headerValue(body.headers?.["x-api-token"]);
  if (token === expected) return undefined;
  return json({ code: "UNAUTHORIZED", message: "Missing or invalid API token." }, 401);
}

function bearerToken(value: string | string[] | undefined): string | undefined {
  const header = headerValue(value);
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function auditApiSideEffect(method: string, path: string, details?: Record<string, unknown>): void {
  const safeDetails = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[api:audit] ${new Date().toISOString()} ${method} ${path}${safeDetails}`);
}

async function upsertAgentResponse(name: string, input: AgentCreateInput): Promise<Record<string, unknown>> {
  const exists = await agentExists(name);
  const agent = exists ? await updateAgent(name, input) : await createAgent(input);
  return { agent, created: !exists, updated: exists, path: agent.path, etag: agent.etag };
}

async function upsertAutomationResponse(name: string, input: AutomationCreateInput): Promise<Record<string, unknown>> {
  const exists = await automationExists(name);
  const automation = exists ? await updateAutomation(name, input) : await createAutomation(input);
  return { automation, created: !exists, updated: exists, path: automation.path, etag: automation.etag };
}

async function setupAutomationResponse(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const agentObject = requiredRecord(input.agent, "agent");
  const automationObject = requiredRecord(input.automation, "automation");
  const agent = agentInput(agentObject);
  const automationName = stringValue(automationObject.name, "automation.name");
  const automation = automationInput({ agent: agent.name, ...automationObject }, automationName);
  const warnings: string[] = [];

  const agentResult = await upsertAgentResponse(agent.name, agent);
  const automationResult = await upsertAutomationResponse(automationName, automation);

  let cron: unknown;
  if (input.installCron === true) {
    auditApiSideEffect("POST", "/api/setup/automation", { action: "installCron", automation: automationName });
    try {
      cron = await installAutomationCron(automationName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Cron install failed: ${message}`);
      cron = { ok: false, error: message };
    }
  }

  let run: unknown;
  if (input.runNow === true) {
    auditApiSideEffect("POST", "/api/setup/automation", { action: "runNow", automation: automationName });
    try {
      run = await runAutomationNow(automationName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Run now failed: ${message}`);
      run = { ok: false, error: message };
    }
  }

  return { agent: agentResult, automation: automationResult, cron, run, warnings };
}

async function automationStatusResponse(name: string, limit = 10): Promise<Record<string, unknown>> {
  const automation = await getAutomation(name);
  const cronStatus = await getCronStatus();
  const cron = cronStatus.automations.find((block) => block.name === name) || null;
  const runs = await listRuns({ automation: name, limit });
  const warnings: string[] = [];

  if (automation.schedule === "manual" && cron) warnings.push("Manual automation has an installed cron block.");
  if (automation.schedule !== "manual" && !cron) warnings.push("Cron schedule is not installed in the user crontab.");
  if (cron?.warning) warnings.push(`Cron block warning: ${cron.warning}`);
  if (runs.some((run) => run.status !== "ok" && run.status !== "running")) warnings.push("Recent runs include failures.");

  return {
    automation: {
      name: automation.name,
      agent: automation.agent,
      schedule: automation.schedule,
      model: automation.model,
      path: automation.path,
      etag: automation.etag,
    },
    cron: cron ? { installed: true, block: cron.block, line: cron.line, warning: cron.warning } : { installed: false },
    connectors: connectorSummary(automation.web, automation.notify),
    recentRuns: runs.map(summarizeRun),
    warnings,
  };
}

async function agentExists(name: string): Promise<boolean> {
  try {
    await getAgent(name);
    return true;
  } catch (error) {
    if (error instanceof CoreError && error.code === "NOT_FOUND") return false;
    throw error;
  }
}

async function automationExists(name: string): Promise<boolean> {
  try {
    await getAutomation(name);
    return true;
  } catch (error) {
    if (error instanceof CoreError && error.code === "NOT_FOUND") return false;
    throw error;
  }
}

function connectorSummary(web: unknown, notify: unknown): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  const webConfig = optionalRecord(web);
  const notifyConfig = optionalRecord(notify);
  if (webConfig) summary.web = Object.fromEntries(Object.entries(webConfig).map(([name, config]) => [name, summarizeConnectorConfig(config)]));
  if (notifyConfig) summary.notify = Object.fromEntries(Object.entries(notifyConfig).map(([name, config]) => [name, summarizeConnectorConfig(config)]));
  return summary;
}

function summarizeConnectorConfig(config: unknown): Record<string, unknown> {
  const record = optionalRecord(config);
  if (!record) return { configured: true };
  return {
    configured: true,
    enabled: record.enabled,
    connector: record.connector,
  };
}

function summarizeRun(run: Awaited<ReturnType<typeof listRuns>>[number]): Record<string, unknown> {
  return {
    id: run.id,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    durationMs: run.durationMs,
    exitCode: run.exitCode,
    signal: run.signal,
    outputPreview: preview(run.outputText),
    errorPreview: preview(run.errorText),
    connectorActions: summarizeConnectorActions(run.connectorActionsJson),
  };
}

function summarizeConnectorActions(value: string | null | undefined): Record<string, unknown> {
  if (!value) return { count: 0 };
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return { count: 0 };
    return {
      count: parsed.length,
      actions: parsed.map((action) => {
        const record = optionalRecord(action);
        if (!record) return { status: "unknown" };
        return { intent: record.intent, connector: record.connector, status: record.status };
      }),
    };
  } catch {
    return { count: 0, warning: "Could not parse connector actions." };
  }
}

function preview(value: string | null | undefined, max = 240): string {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function errorJson(error: unknown): ResponseData {
  if (error instanceof CoreError) {
    return json({ code: error.code, message: error.message, ...(error.fields.length ? { fields: error.fields } : {}) }, error.status);
  }
  const message = error instanceof Error ? error.message : String(error);
  return json({ code: "INTERNAL_ERROR", message }, 500);
}

function readObject(body: RequestBody, allowEmpty = false): Record<string, unknown> {
  if (body.json === undefined || body.json === null) {
    if (allowEmpty) return {};
    throw new CoreError({ code: "VALIDATION_FAILED", message: "JSON object body is required." });
  }
  if (typeof body.json !== "object" || Array.isArray(body.json)) throw new CoreError({ code: "VALIDATION_FAILED", message: "JSON object body is required." });
  return body.json as Record<string, unknown>;
}

function agentInput(input: Record<string, unknown>): AgentCreateInput {
  return { name: stringValue(input.name, "name"), content: stringValue(input.content ?? input.rawMarkdown, "content") };
}

function agentUpdateInput(name: string, input: Record<string, unknown>): AgentCreateInput {
  return { name: stringValue(input.name ?? name, "name"), content: stringValue(input.content ?? input.rawMarkdown, "content") };
}

function automationInput(input: Record<string, unknown>, fallbackName?: string): AutomationCreateInput {
  return {
    name: stringValue(input.name ?? fallbackName, "name"),
    agent: optionalString(input.agent),
    schedule: optionalString(input.schedule),
    model: optionalString(input.model),
    prompt: typeof input.prompt === "string" ? input.prompt : undefined,
    web: input.web,
    notify: input.notify,
    frontmatter: optionalRecord(input.frontmatter),
    rawMarkdown: typeof input.rawMarkdown === "string" ? input.rawMarkdown : undefined,
  };
}

function boardInput(input: Record<string, unknown>, fallbackId?: string): BoardCreateInput {
  return {
    id: stringValue(input.id ?? fallbackId, "id"),
    name: stringValue(input.name ?? input.id ?? fallbackId, "name"),
    description: stringValue(input.description ?? "", "description"),
    defaultAgent: optionalString(input.defaultAgent ?? input.default_agent),
    body: stringValue(input.body ?? "", "body"),
  };
}

function taskInput(input: Record<string, unknown>): TaskCreateInput {
  return {
    id: optionalString(input.id),
    board: stringValue(input.board ?? input.project, "board"),
    title: stringValue(input.title, "title"),
    status: stringValue(input.status ?? "not-yet", "status") as TaskStatus,
    assignee: optionalString(input.assignee),
    priority: stringValue(input.priority ?? "normal", "priority") as TaskPriority,
    body: stringValue(input.body ?? "", "body"),
  };
}

function taskUpdateInput(input: Record<string, unknown>, board: string, id: string): TaskCreateInput & { id: string } {
  return { ...taskInput({ ...input, board: input.board ?? board, id: input.id ?? id }), id: stringValue(input.id ?? id, "id") };
}

function cronInstallInput(input: Record<string, unknown>): CronInstallInput {
  return { schedule: optionalString(input.schedule), limit: optionalNumber(input.limit) };
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string") throw new CoreError({ code: "VALIDATION_FAILED", message: `${field} is required.`, fields: [{ field, message: `${field} is required.` }] });
  return value;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function requiredRecord(value: unknown, field: string): Record<string, unknown> {
  const record = optionalRecord(value);
  if (!record) throw new CoreError({ code: "VALIDATION_FAILED", message: `${field} is required.`, fields: [{ field, message: `${field} is required.` }] });
  return record;
}
