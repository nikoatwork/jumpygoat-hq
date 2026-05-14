import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";

async function withTempHome<T>(fn: () => Promise<T>): Promise<T> {
  const previousHome = process.env.JUMPYGOATHQ_HOME;
  const tempHome = await mkdtemp(path.join(os.tmpdir(), "jumpygoathq-api-"));
  try {
    process.env.JUMPYGOATHQ_HOME = tempHome;
    return await fn();
  } finally {
    if (previousHome === undefined) delete process.env.JUMPYGOATHQ_HOME;
    else process.env.JUMPYGOATHQ_HOME = previousHome;
    await rm(tempHome, { recursive: true, force: true });
  }
}

test("JSON API supports agent and automation CRUD through core", async () => {
  await withTempHome(async () => {
    const { route } = await import("../../packages/web/dist/routes.js");

    let response = await route("POST", new URL("http://local.test/api/agents"), {
      json: {
        name: "helper",
        content: "---\nname: helper\ndescription: API helper\nallowedIntents: []\n---\n\n## Identity\n\nHelp via API.\n",
      },
    });
    expect(response.status).toBe(201);
    expect(JSON.parse(response.body).agent.name).toBe("helper");

    response = await route("POST", new URL("http://local.test/api/automations"), {
      json: { name: "daily", agent: "helper", schedule: "manual", prompt: "Say hi." },
    });
    expect(response.status).toBe(201);
    expect(JSON.parse(response.body).automation.prompt).toBe("Say hi.");

    response = await route("GET", new URL("http://local.test/api/automations/daily?raw=1"));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body).automation.rawMarkdown).toContain("Say hi.");

    response = await route("PUT", new URL("http://local.test/api/automations/daily"), {
      json: { agent: "helper", schedule: "manual", prompt: "Say hello." },
    });
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body).automation.prompt).toBe("Say hello.");

    response = await route("DELETE", new URL("http://local.test/api/automations/daily"));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body).ok).toBe(true);

    response = await route("DELETE", new URL("http://local.test/api/agents/helper"));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body).ok).toBe(true);
  });
});

test("JSON API supports board and task CRUD through core", async () => {
  await withTempHome(async () => {
    const { route } = await import("../../packages/web/dist/routes.js");

    let response = await route("POST", new URL("http://local.test/api/boards"), {
      json: { id: "ops", name: "Ops", description: "Ops board", body: "# Ops\n" },
    });
    expect(response.status).toBe(201);
    expect(JSON.parse(response.body).board.id).toBe("ops");

    response = await route("POST", new URL("http://local.test/api/tasks"), {
      json: { id: "first-task", board: "ops", title: "First task", status: "not-yet", priority: "normal", body: "Do it." },
    });
    expect(response.status).toBe(201);
    expect(JSON.parse(response.body).task.id).toBe("first-task");

    response = await route("PATCH", new URL("http://local.test/api/boards/ops/tasks/first-task/status"), { json: { status: "done" } });
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body).task.status).toBe("done");

    response = await route("GET", new URL("http://local.test/api/tasks?board=ops&status=done"));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body).tasks).toHaveLength(1);

    response = await route("DELETE", new URL("http://local.test/api/boards/ops/tasks/first-task"));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body).ok).toBe(true);
  });
});

test("JSON API returns deterministic structured errors", async () => {
  await withTempHome(async () => {
    const { route } = await import("../../packages/web/dist/routes.js");

    const response = await route("POST", new URL("http://local.test/api/agents"), { json: { name: "Bad Name", content: "" } });
    expect(response.status).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.fields.length).toBeGreaterThan(0);
  });
});

test("JSON API requires bearer token when configured", async () => {
  const previousToken = process.env.JUMPYGOATHQ_API_TOKEN;
  process.env.JUMPYGOATHQ_API_TOKEN = "secret-token";
  try {
    const { route } = await import("../../packages/web/dist/routes.js");

    let response = await route("GET", new URL("http://local.test/api/agents"));
    expect(response.status).toBe(401);
    expect(JSON.parse(response.body).code).toBe("UNAUTHORIZED");

    response = await route("GET", new URL("http://local.test/api/agents"), { headers: { authorization: "Bearer secret-token" } });
    expect(response.status).toBe(200);
  } finally {
    if (previousToken === undefined) delete process.env.JUMPYGOATHQ_API_TOKEN;
    else process.env.JUMPYGOATHQ_API_TOKEN = previousToken;
  }
});
