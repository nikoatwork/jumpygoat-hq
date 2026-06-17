import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const cliBin = path.join(repoRoot, "packages/cli/dist/index.js");
const webBin = path.join(repoRoot, "packages/web/dist/index.js");

async function main(): Promise<void> {
  assertApiOnlyCli();

  const tempHome = await mkdtemp(path.join(os.tmpdir(), "jumpygoathq-cli-api-home-"));
  const tempConfigDir = await mkdtemp(path.join(os.tmpdir(), "jumpygoathq-cli-api-config-"));
  const tempCrontab = path.join(tempHome, "crontab.txt");
  const port = await pickPort();
  const apiUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(port),
    JUMPYGOATHQ_HOME: tempHome,
    JUMPYGOATHQ_CRONTAB_FILE: tempCrontab,
    JUMPYGOATHQ_CLI_CONFIG: path.join(tempConfigDir, "config.json"),
  };

  let server: ChildProcess | undefined;
  try {
    server = spawn(process.execPath, [webBin], { cwd: repoRoot, env, stdio: ["ignore", "pipe", "pipe"] });
    const serverLogs: string[] = [];
    server.stdout?.on("data", (chunk) => serverLogs.push(String(chunk)));
    server.stderr?.on("data", (chunk) => serverLogs.push(String(chunk)));
    await waitForApi(apiUrl, server, serverLogs);

    await expectApiRequired(env, tempHome);

    await cli(env, apiUrl, ["agents", "create", "smoke-agent", "--content", agentContent("Smoke helper")]);
    await expectArray(await cliJson(env, apiUrl, ["agents", "list"]), "agents list");
    await expectField(await cliJson(env, apiUrl, ["agents", "view", "smoke-agent"]), "name", "smoke-agent");
    await cli(env, apiUrl, ["agents", "update", "smoke-agent", "--content", agentContent("Smoke helper v2")]);

    await cli(env, apiUrl, ["automations", "create", "smoke-auto", "--agent", "smoke-agent", "--schedule", "manual", "--prompt", "Say hi."]);
    await expectArray(await cliJson(env, apiUrl, ["automations", "list"]), "automations list");
    await expectField(await cliJson(env, apiUrl, ["automations", "view", "smoke-auto"]), "name", "smoke-auto");
    await cli(env, apiUrl, ["automations", "update", "smoke-auto", "--agent", "smoke-agent", "--schedule", "*/5 * * * *", "--prompt", "Say hello."]);
    await cliJson(env, apiUrl, ["automations", "status", "smoke-auto", "--limit", "2"]);

    await cli(env, apiUrl, ["boards", "create", "smoke-board", "--name", "Smoke board", "--description", "CLI API smoke", "--body", "Board body."]);
    await expectArray(await cliJson(env, apiUrl, ["boards", "list"]), "boards list");
    await expectField(await cliJson(env, apiUrl, ["boards", "view", "smoke-board"]), "id", "smoke-board");
    await cli(env, apiUrl, ["boards", "update", "smoke-board", "--name", "Smoke board v2", "--description", "Updated", "--body", "Updated board body."]);

    const task = await cliJson(env, apiUrl, ["tasks", "create", "--board", "smoke-board", "--title", "Smoke task", "--status", "ready", "--assignee", "smoke-agent", "--body", "Do the smoke task."]);
    const taskId = stringProp(task, "id");
    await expectArray(await cliJson(env, apiUrl, ["tasks", "list", "--board", "smoke-board"]), "tasks list");
    await expectField(await cliJson(env, apiUrl, ["tasks", "view", "smoke-board", taskId]), "id", taskId);
    await cli(env, apiUrl, ["tasks", "status", "smoke-board", taskId, "--status", "done"]);
    await cli(env, apiUrl, ["tasks", "update", "--board", "smoke-board", "--id", taskId, "--title", "Smoke task v2", "--status", "not-yet", "--priority", "high", "--assignee", "smoke-agent", "--body", "Updated smoke task."]);

    const setupFile = path.join(tempHome, "setup.json");
    await writeFile(setupFile, JSON.stringify({
      agent: {
        name: "setup-agent",
        content: "---\nname: setup-agent\ndescription: Setup smoke agent\nallowedIntents: []\n---\n\n## Identity\n\nHelp setup smoke.\n",
      },
      automation: { name: "setup-auto", schedule: "manual", prompt: "Setup smoke prompt." },
    }), "utf8");
    await cliJson(env, apiUrl, ["setup", "automation", "--file", setupFile]);

    await cliJson(env, apiUrl, ["settings", "view"]);
    await cliJson(env, apiUrl, ["settings", "update", "--content", "defaultModelProfile: null\nmodelProfiles: {}\n"]);
    await expectArray(await cliJson(env, apiUrl, ["runs", "list", "--limit", "5"]), "runs list");
    await cliJson(env, apiUrl, ["cron", "status"]);
    await cliJson(env, apiUrl, ["cron", "install-automation", "smoke-auto"]);
    await cliJson(env, apiUrl, ["cron", "uninstall-automation", "smoke-auto"]);
    await cliJson(env, apiUrl, ["cron", "install-task-heartbeat", "--schedule", "*/10 * * * *", "--limit", "1"]);
    await cliJson(env, apiUrl, ["cron", "uninstall-task-heartbeat"]);

    await cli(env, apiUrl, ["tasks", "delete", "smoke-board", taskId]);
    await cli(env, apiUrl, ["boards", "delete", "smoke-board"]);
    await cli(env, apiUrl, ["automations", "delete", "smoke-auto"]);
    await cli(env, apiUrl, ["automations", "delete", "setup-auto"]);
    await cli(env, apiUrl, ["agents", "delete", "smoke-agent"]);
    await cli(env, apiUrl, ["agents", "delete", "setup-agent"]);

    console.log("CLI API smoke passed.");
  } finally {
    if (server) await stopServer(server);
    await rm(tempHome, { recursive: true, force: true });
    await rm(tempConfigDir, { recursive: true, force: true });
  }
}

function assertApiOnlyCli(): void {
  const source = readFileSync(path.join(repoRoot, "packages/cli/src/index.ts"), "utf8");
  const packageJson = readFileSync(path.join(repoRoot, "packages/cli/package.json"), "utf8");
  if (source.includes("@jumpygoat-hq/core") || packageJson.includes("@jumpygoat-hq/core")) {
    throw new Error("CLI still references @jumpygoat-hq/core; expected API-only CLI.");
  }
}

async function expectApiRequired(env: NodeJS.ProcessEnv, tempHome: string): Promise<void> {
  const orphanAgent = path.join(tempHome, "agents", "orphan", "AGENT.md");
  await writeFile(orphanAgent, agentContent("Should not be read locally"), { encoding: "utf8", flag: "w" }).catch(async (error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    await import("node:fs/promises").then(({ mkdir }) => mkdir(path.dirname(orphanAgent), { recursive: true }));
    await writeFile(orphanAgent, agentContent("Should not be read locally"), "utf8");
  });
  const unusedPort = await pickPort();
  const result = await runCli(env, [`--api-url`, `http://127.0.0.1:${unusedPort}`, "--json", "agents", "list"], { allowFailure: true });
  if (result.code === 0) throw new Error("CLI succeeded against an unreachable API URL; expected API-only failure.");
  if (!result.stderr.includes("Could not reach jumpyGoatHq API")) throw new Error(`Unexpected unreachable API error:\n${result.stderr}`);
}

async function cli(env: NodeJS.ProcessEnv, apiUrl: string, args: string[]): Promise<string> {
  const result = await runCli(env, ["--api-url", apiUrl, "--json", ...args]);
  return result.stdout;
}

async function cliJson(env: NodeJS.ProcessEnv, apiUrl: string, args: string[]): Promise<unknown> {
  const stdout = await cli(env, apiUrl, args);
  return stdout.trim() ? JSON.parse(stdout) as unknown : null;
}

async function runCli(env: NodeJS.ProcessEnv, args: string[], options: { allowFailure?: boolean } = {}): Promise<{ code: number; stdout: string; stderr: string }> {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliBin, ...args], { cwd: repoRoot, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (code) => {
      const exitCode = code ?? 1;
      if (exitCode !== 0 && !options.allowFailure) {
        reject(new Error(`CLI failed (${exitCode}): ${args.join(" ")}\nstdout:\n${stdout}\nstderr:\n${stderr}`));
        return;
      }
      resolve({ code: exitCode, stdout, stderr });
    });
  });
}

async function waitForApi(apiUrl: string, server: ChildProcess, serverLogs: string[]): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Web server exited before API was ready. Logs:\n${serverLogs.join("")}`);
    try {
      const response = await fetch(`${apiUrl}/api`);
      if (response.ok) return;
    } catch {
      // Retry until deadline.
    }
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${apiUrl}/api. Logs:\n${serverLogs.join("")}`);
}

async function stopServer(server: ChildProcess): Promise<void> {
  if (server.exitCode !== null) return;
  server.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => server.on("close", () => resolve())),
    delay(5_000).then(() => {
      if (server.exitCode === null) server.kill("SIGKILL");
    }),
  ]);
}

async function pickPort(): Promise<number> {
  const net = await import("node:net");
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not pick an available port.")));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

function expectArray(value: unknown, label: string): void {
  if (!Array.isArray(value)) throw new Error(`${label} did not return an array.`);
}

function expectField(value: unknown, field: string, expected: string): void {
  const actual = stringProp(value, field);
  if (actual !== expected) throw new Error(`Expected ${field}=${expected}, got ${actual}.`);
}

function stringProp(value: unknown, field: string): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Expected object with ${field}.`);
  const actual = (value as Record<string, unknown>)[field];
  if (typeof actual !== "string" || !actual) throw new Error(`Expected string field ${field}.`);
  return actual;
}

function agentContent(description: string): string {
  return `---\nname: smoke-agent\ndescription: ${description}\nallowedIntents: []\n---\n\n## Identity\n\nHelp the CLI/API smoke test.\n`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
