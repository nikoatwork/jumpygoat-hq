#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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

type GlobalOptions = {
  apiUrl?: string;
  token?: string;
  instance?: string;
  json: boolean;
  help: boolean;
};

type InstanceConfig = {
  apiUrl: string;
  token?: string;
};

type CliConfig = {
  defaultInstance?: string;
  instances: Record<string, InstanceConfig>;
};

type Client = {
  mode: "local" | "remote";
  apiUrl?: string;
  token?: string;
};

type Parsed = {
  globals: GlobalOptions;
  command: string[];
  flags: Record<string, string | boolean>;
  positionals: string[];
};

const CONFIG_PATH = process.env.JUMPYGOATHQ_CLI_CONFIG || path.join(os.homedir(), ".config", "jumpygoathq", "config.json");
const VALUE_FLAGS = new Set([
  "agent",
  "api-url",
  "apiUrl",
  "assignee",
  "board",
  "body",
  "content",
  "default-agent",
  "description",
  "file",
  "id",
  "instance",
  "limit",
  "model",
  "name",
  "priority",
  "prompt",
  "schedule",
  "status",
  "title",
  "token",
]);

void main().catch((error) => {
  printError(error);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  const [resource, action = defaultAction(parsed.command[0]), ...rest] = parsed.command;

  if (!resource || parsed.globals.help || resource === "help" || resource === "--help" || resource === "-h") {
    printHelp();
    return;
  }

  if (resource === "instances" || resource === "config") {
    await handleInstances(action, rest, parsed);
    return;
  }

  const client = await resolveClient(parsed.globals);

  switch (resource) {
    case "agents":
    case "agent":
      await handleAgents(client, action, rest, parsed);
      return;
    case "automations":
    case "automation":
      await handleAutomations(client, action, rest, parsed);
      return;
    case "boards":
    case "board":
      await handleBoards(client, action, rest, parsed);
      return;
    case "tasks":
    case "task":
      await handleTasks(client, action, rest, parsed);
      return;
    case "runs":
    case "run":
      await handleRuns(client, action, rest, parsed);
      return;
    case "settings":
      await handleSettings(client, action, rest, parsed);
      return;
    case "cron":
      await handleCron(client, action, rest, parsed);
      return;
    default:
      throw new Error(`Unknown command: ${resource}`);
  }
}

async function handleInstances(action: string, rest: string[], parsed: Parsed): Promise<void> {
  if (action === "list" || action === "ls") {
    const config = readConfig();
    const rows = Object.entries(config.instances).map(([name, instance]) => ({ name, apiUrl: instance.apiUrl, default: config.defaultInstance === name }));
    output(rows, parsed.globals, (items: typeof rows) => {
      if (!items.length) return "No instances configured.";
      return items.map((item) => `${item.default ? "*" : " "} ${item.name}\t${item.apiUrl}`).join("\n");
    });
    return;
  }

  if (action === "add") {
    const name = rest[0] || stringFlag(parsed, "name");
    const apiUrl = parsed.globals.apiUrl || stringFlag(parsed, "api-url") || stringFlag(parsed, "apiUrl");
    const token = parsed.globals.token || optionalStringFlag(parsed, "token");
    if (!name) throw new Error("Usage: jumpygoathq instances add <name> --api-url <url> [--token <token>]");
    if (!apiUrl) throw new Error("--api-url is required.");
    const config = readConfig();
    config.instances[name] = { apiUrl, ...(token ? { token } : {}) };
    if (!config.defaultInstance) config.defaultInstance = name;
    await writeConfig(config);
    print(`Added instance ${name}.`);
    return;
  }

  if (action === "use") {
    const name = rest[0] || stringFlag(parsed, "name");
    if (!name) throw new Error("Usage: jumpygoathq instances use <name>");
    const config = readConfig();
    if (!config.instances[name]) throw new Error(`Unknown instance: ${name}`);
    config.defaultInstance = name;
    await writeConfig(config);
    print(`Default instance set to ${name}.`);
    return;
  }

  if (action === "show") {
    const config = readConfig();
    const name = rest[0] || parsed.globals.instance || config.defaultInstance;
    if (!name) throw new Error("No instance selected.");
    const instance = config.instances[name];
    if (!instance) throw new Error(`Unknown instance: ${name}`);
    output({ name, apiUrl: instance.apiUrl, hasToken: Boolean(instance.token), default: config.defaultInstance === name }, parsed.globals);
    return;
  }

  if (action === "remove" || action === "rm") {
    const name = rest[0] || stringFlag(parsed, "name");
    if (!name) throw new Error("Usage: jumpygoathq instances remove <name>");
    const config = readConfig();
    delete config.instances[name];
    if (config.defaultInstance === name) config.defaultInstance = Object.keys(config.instances)[0];
    await writeConfig(config);
    print(`Removed instance ${name}.`);
    return;
  }

  throw new Error(`Unknown instances action: ${action}`);
}

async function handleAgents(client: Client, action: string, rest: string[], parsed: Parsed): Promise<void> {
  if (isList(action)) return output(await call(client, () => listAgents({ includeRaw: boolFlag(parsed, "raw") }), "GET", "/api/agents" + rawQuery(parsed)), parsed.globals, listSummary("agents", "name", "description"));
  const name = rest[0] || stringFlag(parsed, "name");
  if (action === "view" || action === "get" || action === "show") return output(await call(client, () => getAgent(required(name, "agent name"), { includeRaw: boolFlag(parsed, "raw") }), "GET", `/api/agents/${required(name, "agent name")}${rawQuery(parsed)}`), parsed.globals);
  if (action === "create") {
    const input = { name: required(name, "agent name"), content: await contentFromFlags(parsed, "content", "file") };
    return output(await call(client, () => createAgent(input), "POST", "/api/agents", input), parsed.globals);
  }
  if (action === "update" || action === "edit") {
    const input = { name: required(name, "agent name"), content: await contentFromFlags(parsed, "content", "file") };
    return output(await call(client, () => updateAgent(input.name, input), "PUT", `/api/agents/${input.name}`, input), parsed.globals);
  }
  if (isDelete(action)) return output(await call(client, () => deleteAgent(required(name, "agent name")).then(ok), "DELETE", `/api/agents/${required(name, "agent name")}`), parsed.globals);
  throw new Error(`Unknown agents action: ${action}`);
}

async function handleAutomations(client: Client, action: string, rest: string[], parsed: Parsed): Promise<void> {
  if (isList(action)) return output(await call(client, () => listAutomations({ includeRaw: boolFlag(parsed, "raw") }), "GET", "/api/automations" + rawQuery(parsed)), parsed.globals, listSummary("automations", "name", "agent", "schedule"));
  const name = rest[0] || stringFlag(parsed, "name");
  if (action === "view" || action === "get" || action === "show") return output(await call(client, () => getAutomation(required(name, "automation name"), { includeRaw: boolFlag(parsed, "raw") }), "GET", `/api/automations/${required(name, "automation name")}${rawQuery(parsed)}`), parsed.globals);
  if (action === "create") {
    const input = automationInput(parsed, required(name, "automation name"));
    return output(await call(client, () => createAutomation(input), "POST", "/api/automations", input), parsed.globals);
  }
  if (action === "update" || action === "edit") {
    const input = automationInput(parsed, required(name, "automation name"));
    return output(await call(client, () => updateAutomation(input.name, input), "PUT", `/api/automations/${input.name}`, input), parsed.globals);
  }
  if (action === "run") return output(await call(client, () => runAutomationNow(required(name, "automation name")), "POST", `/api/automations/${required(name, "automation name")}/runs`, {}), parsed.globals);
  if (isDelete(action)) return output(await call(client, () => deleteAutomation(required(name, "automation name")).then(ok), "DELETE", `/api/automations/${required(name, "automation name")}`), parsed.globals);
  throw new Error(`Unknown automations action: ${action}`);
}

async function handleBoards(client: Client, action: string, rest: string[], parsed: Parsed): Promise<void> {
  if (isList(action)) return output(await call(client, () => listBoards({ includeRaw: boolFlag(parsed, "raw") }), "GET", "/api/boards" + rawQuery(parsed)), parsed.globals, listSummary("boards", "id", "name", "description"));
  const id = rest[0] || stringFlag(parsed, "id") || stringFlag(parsed, "board");
  if (action === "view" || action === "get" || action === "show") return output(await call(client, () => getBoard(required(id, "board id"), { includeRaw: boolFlag(parsed, "raw") }), "GET", `/api/boards/${required(id, "board id")}${rawQuery(parsed)}`), parsed.globals);
  if (action === "create") {
    const input = boardInput(parsed, required(id, "board id"));
    return output(await call(client, () => createBoard(input), "POST", "/api/boards", input), parsed.globals);
  }
  if (action === "update" || action === "edit") {
    const input = boardInput(parsed, required(id, "board id"));
    return output(await call(client, () => updateBoard(input.id, input), "PUT", `/api/boards/${input.id}`, input), parsed.globals);
  }
  if (isDelete(action)) return output(await call(client, () => deleteBoard(required(id, "board id")).then(ok), "DELETE", `/api/boards/${required(id, "board id")}`), parsed.globals);
  throw new Error(`Unknown boards action: ${action}`);
}

async function handleTasks(client: Client, action: string, rest: string[], parsed: Parsed): Promise<void> {
  if (isList(action)) {
    const query = queryString({ board: optionalStringFlag(parsed, "board"), status: optionalStringFlag(parsed, "status") });
    return output(await call(client, () => listTasks({ board: optionalStringFlag(parsed, "board"), status: optionalStringFlag(parsed, "status") as TaskStatus | undefined }), "GET", `/api/tasks${query}`), parsed.globals, listSummary("tasks", "board", "id", "status", "title"));
  }
  const board = stringFlag(parsed, "board") || rest[0];
  const id = stringFlag(parsed, "id") || rest[1];
  if (action === "view" || action === "get" || action === "show") return output(await call(client, () => getTask(required(board, "board"), required(id, "task id"), { includeRaw: boolFlag(parsed, "raw") }), "GET", `/api/boards/${required(board, "board")}/tasks/${required(id, "task id")}${rawQuery(parsed)}`), parsed.globals);
  if (action === "create") {
    const input = taskInput(parsed, id);
    return output(await call(client, () => createTask(input), "POST", "/api/tasks", input), parsed.globals);
  }
  if (action === "update" || action === "edit") {
    const input = taskInput(parsed, id) as TaskCreateInput & { id: string };
    input.id = required(input.id, "task id");
    return output(await call(client, () => updateTask(required(input.board, "board"), input.id, input), "PUT", `/api/boards/${input.board}/tasks/${input.id}`, input), parsed.globals);
  }
  if (action === "status") {
    const status = stringFlag(parsed, "status") || rest[2];
    return output(await call(client, () => updateTaskStatus(required(board, "board"), required(id, "task id"), { status: required(status, "status") as TaskStatus }), "PATCH", `/api/boards/${required(board, "board")}/tasks/${required(id, "task id")}/status`, { status }), parsed.globals);
  }
  if (isDelete(action)) return output(await call(client, () => deleteTask(required(board, "board"), required(id, "task id")).then(ok), "DELETE", `/api/boards/${required(board, "board")}/tasks/${required(id, "task id")}`), parsed.globals);
  throw new Error(`Unknown tasks action: ${action}`);
}

async function handleRuns(client: Client, action: string, rest: string[], parsed: Parsed): Promise<void> {
  if (isList(action)) {
    const limit = optionalNumberFlag(parsed, "limit");
    return output(await call(client, () => listRuns({ limit }), "GET", `/api/runs${queryString({ limit })}`), parsed.globals, listSummary("runs", "id", "status", "automation", "agent"));
  }
  const id = rest[0] || stringFlag(parsed, "id");
  if (action === "view" || action === "get" || action === "show") return output(await call(client, () => getRun(required(id, "run id")), "GET", `/api/runs/${required(id, "run id")}`), parsed.globals);
  throw new Error(`Unknown runs action: ${action}`);
}

async function handleSettings(client: Client, action: string, _rest: string[], parsed: Parsed): Promise<void> {
  if (action === "view" || action === "get" || action === "show") return output(await call(client, () => getSettings(), "GET", "/api/settings"), parsed.globals);
  if (action === "update" || action === "set") {
    const content = await contentFromFlags(parsed, "content", "file");
    return output(await call(client, () => updateSettings({ content }), "PUT", "/api/settings", { content }), parsed.globals);
  }
  throw new Error(`Unknown settings action: ${action}`);
}

async function handleCron(client: Client, action: string, rest: string[], parsed: Parsed): Promise<void> {
  if (action === "status" || action === "view" || action === "get") return output(await call(client, () => getCronStatus(), "GET", "/api/cron"), parsed.globals);
  if (action === "install-automation") {
    const name = rest[0] || stringFlag(parsed, "name");
    return output(await call(client, () => installAutomationCron(required(name, "automation name")), "PUT", `/api/cron/automations/${required(name, "automation name")}`, {}), parsed.globals);
  }
  if (action === "uninstall-automation") {
    const name = rest[0] || stringFlag(parsed, "name");
    return output(await call(client, () => uninstallAutomationCron(required(name, "automation name")), "DELETE", `/api/cron/automations/${required(name, "automation name")}`), parsed.globals);
  }
  if (action === "install-task-heartbeat") {
    const input: CronInstallInput = { schedule: optionalStringFlag(parsed, "schedule"), limit: optionalNumberFlag(parsed, "limit") };
    return output(await call(client, () => installTaskHeartbeatCron(input), "PUT", "/api/cron/task-heartbeat", input), parsed.globals);
  }
  if (action === "uninstall-task-heartbeat") return output(await call(client, () => uninstallTaskHeartbeatCron(), "DELETE", "/api/cron/task-heartbeat"), parsed.globals);
  throw new Error(`Unknown cron action: ${action}`);
}

async function call<T>(client: Client, local: () => Promise<T>, method: string, apiPath: string, body?: unknown): Promise<unknown> {
  if (client.mode === "local") return await local();
  return await remoteRequest(client, method, apiPath, body);
}

async function remoteRequest(client: Client, method: string, apiPath: string, body?: unknown): Promise<unknown> {
  const base = required(client.apiUrl, "api url").replace(/\/+$/, "");
  const response = await fetch(`${base}${apiPath}`, {
    method,
    headers: {
      accept: "application/json",
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(client.token ? { authorization: `Bearer ${client.token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  const parsed = text ? parseJson(text) : null;
  if (!response.ok) {
    const message = isRecord(parsed) && typeof parsed.message === "string" ? parsed.message : `HTTP ${response.status}`;
    throw new Error(message);
  }
  if (isRecord(parsed)) {
    const keys = Object.keys(parsed);
    if (keys.length === 1 && keys[0]) return parsed[keys[0]];
  }
  return parsed;
}

async function resolveClient(globals: GlobalOptions): Promise<Client> {
  const config = readConfig();
  const instanceName = globals.instance || process.env.JUMPYGOATHQ_INSTANCE || config.defaultInstance;
  const instance = instanceName ? config.instances[instanceName] : undefined;
  const apiUrl = globals.apiUrl || process.env.JUMPYGOATHQ_API_URL || instance?.apiUrl;
  const token = globals.token || process.env.JUMPYGOATHQ_TOKEN || instance?.token;
  if (apiUrl) return { mode: "remote", apiUrl, token };
  return { mode: "local" };
}

function parseArgs(argv: string[]): Parsed {
  const globals: GlobalOptions = { json: false, help: false };
  const command: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let positionalMode = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "--") {
      positionalMode = true;
      continue;
    }
    if (!positionalMode && arg.startsWith("--")) {
      const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
      const key = rawKey!;
      const value = inlineValue ?? (VALUE_FLAGS.has(key) && argv[index + 1] !== undefined ? argv[++index] : argv[index + 1] && !argv[index + 1]!.startsWith("-") ? argv[++index] : true);
      if (key === "api-url") globals.apiUrl = String(value);
      else if (key === "token") globals.token = String(value);
      else if (key === "instance") globals.instance = String(value);
      else if (key === "json") globals.json = true;
      else if (key === "help") globals.help = true;
      else flags[key] = value;
      continue;
    }
    if (!positionalMode && arg === "-j") {
      globals.json = true;
      continue;
    }
    if (!positionalMode && arg === "-h") {
      globals.help = true;
      continue;
    }
    command.push(arg);
  }

  return { globals, command, flags, positionals: command.slice(2) };
}

function readConfig(): CliConfig {
  if (!existsSync(CONFIG_PATH)) return { instances: {} };
  const parsed = parseJson(readFileSync(CONFIG_PATH, "utf8"));
  if (!isRecord(parsed)) return { instances: {} };
  return {
    defaultInstance: typeof parsed.defaultInstance === "string" ? parsed.defaultInstance : undefined,
    instances: isRecord(parsed.instances) ? (parsed.instances as Record<string, InstanceConfig>) : {},
  };
}

async function writeConfig(config: CliConfig): Promise<void> {
  await mkdir(path.dirname(CONFIG_PATH), { recursive: true, mode: 0o700 });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
}

function output(value: unknown, globals: GlobalOptions, formatter?: (value: any) => string): void {
  if (globals.json) {
    print(JSON.stringify(value, null, 2));
    return;
  }
  if (formatter) {
    print(formatter(value));
    return;
  }
  if (typeof value === "string") print(value);
  else print(JSON.stringify(value, null, 2));
}

function listSummary(label: string, ...fields: string[]): (value: any) => string {
  return (value: any) => {
    const items = Array.isArray(value) ? value : [];
    if (!items.length) return `No ${label} found.`;
    return items.map((item) => fields.map((field) => String(item[field] ?? "")).join("\t")).join("\n");
  };
}

function automationInput(parsed: Parsed, name: string): AutomationCreateInput {
  return {
    name,
    agent: required(stringFlag(parsed, "agent"), "--agent"),
    schedule: stringFlag(parsed, "schedule") || "manual",
    model: optionalStringFlag(parsed, "model"),
    prompt: stringFlag(parsed, "prompt") || readStdinSyncIfRequested(parsed) || required(undefined, "--prompt"),
  };
}

function boardInput(parsed: Parsed, id: string): BoardCreateInput {
  return {
    id,
    name: stringFlag(parsed, "name") || id,
    description: stringFlag(parsed, "description") || "",
    defaultAgent: optionalStringFlag(parsed, "default-agent"),
    body: stringFlag(parsed, "body") || readStdinSyncIfRequested(parsed) || `# ${id}\n`,
  };
}

function taskInput(parsed: Parsed, id?: string): TaskCreateInput {
  return {
    id: id || optionalStringFlag(parsed, "id"),
    board: required(stringFlag(parsed, "board"), "--board"),
    title: required(stringFlag(parsed, "title"), "--title"),
    status: (stringFlag(parsed, "status") || "not-yet") as TaskStatus,
    assignee: optionalStringFlag(parsed, "assignee"),
    priority: (stringFlag(parsed, "priority") || "normal") as TaskPriority,
    body: stringFlag(parsed, "body") || readStdinSyncIfRequested(parsed) || "",
  };
}

async function contentFromFlags(parsed: Parsed, contentFlag: string, fileFlag: string): Promise<string> {
  const content = stringFlag(parsed, contentFlag);
  if (content !== undefined) return content;
  const file = stringFlag(parsed, fileFlag);
  if (file) return await readFile(file, "utf8");
  const stdin = readStdinSyncIfRequested(parsed);
  if (stdin !== undefined) return stdin;
  throw new Error(`Provide --${contentFlag}, --${fileFlag}, or --stdin.`);
}

function readStdinSyncIfRequested(parsed: Parsed): string | undefined {
  if (!boolFlag(parsed, "stdin")) return undefined;
  return readFileSync(0, "utf8");
}

function stringFlag(parsed: Parsed, key: string): string | undefined {
  const value = parsed.flags[key];
  return typeof value === "string" ? value : undefined;
}

function optionalStringFlag(parsed: Parsed, key: string): string | undefined {
  const value = stringFlag(parsed, key);
  return value && value.trim() ? value : undefined;
}

function optionalNumberFlag(parsed: Parsed, key: string): number | undefined {
  const value = stringFlag(parsed, key);
  if (!value) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function boolFlag(parsed: Parsed, key: string): boolean {
  return parsed.flags[key] === true || parsed.flags[key] === "true";
}

function required(value: string | undefined, label: string): string {
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function isList(action: string): boolean {
  return action === "list" || action === "ls";
}

function isDelete(action: string): boolean {
  return action === "delete" || action === "remove" || action === "rm";
}

function defaultAction(resource?: string): string {
  if (!resource) return "help";
  if (["runs", "agents", "automations", "boards", "tasks", "instances"].includes(resource)) return "list";
  if (resource === "cron") return "status";
  return "view";
}

function rawQuery(parsed: Parsed): string {
  return boolFlag(parsed, "raw") ? "?raw=1" : "";
}

function queryString(values: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined) params.set(key, String(value));
  const text = params.toString();
  return text ? `?${text}` : "";
}

function ok(): { ok: true } {
  return { ok: true };
}

function parseJson(text: string): unknown {
  return JSON.parse(text) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function print(value: string): void {
  process.stdout.write(value + "\n");
}

function printError(error: unknown): void {
  if (error instanceof CoreError) {
    process.stderr.write(`${error.code}: ${error.message}\n`);
    for (const field of error.fields) process.stderr.write(`- ${field.field}: ${field.message}\n`);
    return;
  }
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
}

function printHelp(): void {
  print(`jumpygoathq CLI

Usage:
  jumpygoathq [--json] [--api-url URL | --instance NAME] <resource> <action> [args] [flags]

Resources:
  instances     add/list/use/show/remove named remote instances
  agents        list/view/create/update/delete
  automations   list/view/create/update/delete/run
  boards        list/view/create/update/delete
  tasks         list/view/create/update/delete/status
  runs          list/view
  settings      view/update
  cron          status/install-automation/uninstall-automation/install-task-heartbeat/uninstall-task-heartbeat

Examples:
  jumpygoathq agents list
  jumpygoathq agents create helper --file ./AGENT.md
  jumpygoathq automations create daily --agent helper --schedule manual --prompt "Say hi"
  jumpygoathq --api-url https://hq.example.com agents list
  jumpygoathq instances add home --api-url https://hq.example.com --token TOKEN
  jumpygoathq --instance home runs list --limit 10

Local development install:
  pnpm --filter @jumpygoat-hq/cli link --global`);
}
