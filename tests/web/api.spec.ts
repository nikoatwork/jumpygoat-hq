import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import Database from "better-sqlite3";

async function withTempHome<T>(fn: (tempHome: string) => Promise<T>): Promise<T> {
  const previousHome = process.env.JUMPYGOATHQ_HOME;
  const tempHome = await mkdtemp(path.join(os.tmpdir(), "jumpygoathq-api-"));
  try {
    process.env.JUMPYGOATHQ_HOME = tempHome;
    return await fn(tempHome);
  } finally {
    if (previousHome === undefined) delete process.env.JUMPYGOATHQ_HOME;
    else process.env.JUMPYGOATHQ_HOME = previousHome;
    await rm(tempHome, { recursive: true, force: true });
  }
}

async function seedRuns(tempHome: string): Promise<void> {
  const dataDir = path.join(tempHome, "data");
  await mkdir(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "jumpygoat-hq.sqlite"));
  try {
    db.exec(`
      create table runs (
        id text primary key,
        automation text not null,
        source_type text,
        source_id text,
        agent text,
        project text,
        task_id text,
        model text,
        requested_model text,
        resolved_model text,
        model_profile text,
        model_resolution_warning text,
        schedule text,
        status text not null,
        started_at text not null,
        finished_at text,
        duration_ms integer,
        exit_code integer,
        signal text,
        output_text text not null default '',
        trace_text text not null default '',
        error_text text not null default '',
        connector_actions_json text not null default '[]',
        usage_json text
      )
    `);
    const insert = db.prepare(`
      insert into runs (id, automation, agent, schedule, status, started_at, finished_at, duration_ms, exit_code, output_text, trace_text, error_text, connector_actions_json)
      values (@id, 'daily', 'helper', '0 * * * *', @status, @startedAt, @finishedAt, @durationMs, @exitCode, @outputText, @traceText, @errorText, @connectorActionsJson)
    `);
    insert.run({
      id: "run-ok",
      status: "ok",
      startedAt: "2026-05-15T10:00:00.000Z",
      finishedAt: "2026-05-15T10:00:02.000Z",
      durationMs: 2000,
      exitCode: 0,
      outputText: "Successful summary",
      traceText: "large trace should stay out of status response",
      errorText: "",
      connectorActionsJson: JSON.stringify([{ intent: "notify.email", connector: "resend", status: "sent" }]),
    });
    insert.run({
      id: "run-failed",
      status: "error",
      startedAt: "2026-05-15T11:00:00.000Z",
      finishedAt: "2026-05-15T11:00:01.000Z",
      durationMs: 1000,
      exitCode: 1,
      outputText: "",
      traceText: "large failed trace should stay out of status response",
      errorText: "Failed summary",
      connectorActionsJson: JSON.stringify([{ intent: "web.search", connector: "firecrawl", status: "failed" }]),
    });
  } finally {
    db.close();
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

test("JSON API preserves rich automation frontmatter through create and update", async () => {
  await withTempHome(async () => {
    const { route } = await import("../../packages/web/dist/routes.js");

    let response = await route("POST", new URL("http://local.test/api/agents"), {
      json: {
        name: "helper",
        content: "---\nname: helper\ndescription: API helper\nallowedIntents: [web.search, notify.email, mail.send, mail.list, script.run]\n---\n\n## Identity\n\nHelp via API.\n",
      },
    });
    expect(response.status).toBe(201);

    response = await route("POST", new URL("http://local.test/api/automations"), {
      json: {
        name: "daily",
        agent: "helper",
        schedule: "manual",
        prompt: "Search and email a summary.",
        web: { search: { enabled: true, connector: "firecrawl", limit: 2 } },
        notify: { email: { enabled: true, connector: "resend", to: "ops@example.com", from: "Agent <agent@example.com>" } },
        mail: { send: { enabled: true, connector: "agentmail", inboxId: "agent@agentmail.to", to: "ops@example.com" }, list: { enabled: true, connector: "agentmail", inboxId: "agent@agentmail.to", limit: 5 } },
        scripts: { run: { enabled: true, connector: "local-script", allow: ["scripts/search.ts"], network: true, write: false } },
      },
    });
    expect(response.status).toBe(201);
    let automation = JSON.parse(response.body).automation;
    expect(automation.web.search.limit).toBe(2);
    expect(automation.notify.email.to).toBe("ops@example.com");
    expect(automation.mail.send.inboxId).toBe("agent@agentmail.to");
    expect(automation.scripts.run.allow).toEqual(["scripts/search.ts"]);

    response = await route("PUT", new URL("http://local.test/api/automations/daily"), {
      json: { agent: "helper", schedule: "manual", prompt: "Updated prompt, same connector config." },
    });
    expect(response.status).toBe(200);
    automation = JSON.parse(response.body).automation;
    expect(automation.prompt).toBe("Updated prompt, same connector config.");
    expect(automation.web.search.connector).toBe("firecrawl");
    expect(automation.notify.email.to).toBe("ops@example.com");
    expect(automation.mail.list.limit).toBe(5);
    expect(automation.scripts.run.connector).toBe("local-script");
    expect(automation.rawMarkdown).toContain("notify:");
    expect(automation.rawMarkdown).toContain("to: ops@example.com");
    expect(automation.rawMarkdown).toContain("web:");
    expect(automation.rawMarkdown).toContain("mail:");
    expect(automation.rawMarkdown).toContain("scripts:");
    expect(automation.rawMarkdown).toContain("inboxId: agent@agentmail.to");
    expect(automation.rawMarkdown).toContain("limit: 2");

    response = await route("POST", new URL("http://local.test/api/automations"), {
      json: {
        name: "raw-daily",
        rawMarkdown: "---\nagent: helper\nschedule: manual\nweb:\n  search:\n    enabled: true\n    connector: firecrawl\nnotify:\n  email:\n    enabled: true\n    connector: resend\n    to: raw@example.com\n---\n\nRaw markdown prompt.\n",
      },
    });
    expect(response.status).toBe(201);
    automation = JSON.parse(response.body).automation;
    expect(automation.web.search.connector).toBe("firecrawl");
    expect(automation.notify.email.to).toBe("raw@example.com");
    expect(automation.prompt).toBe("Raw markdown prompt.");
  });
});

test("JSON API supports idempotent agent and automation PUT upserts", async () => {
  await withTempHome(async () => {
    const { route } = await import("../../packages/web/dist/routes.js");

    let response = await route("PUT", new URL("http://local.test/api/agents/helper"), {
      json: {
        content: "---\nname: helper\ndescription: API helper\nallowedIntents: []\n---\n\n## Identity\n\nHelp via API.\n",
      },
    });
    expect(response.status).toBe(200);
    let body = JSON.parse(response.body);
    expect(body.created).toBe(true);
    expect(body.updated).toBe(false);
    expect(body.agent.name).toBe("helper");
    expect(body.path).toContain("helper/AGENT.md");
    expect(body.etag).toBeTruthy();

    response = await route("PUT", new URL("http://local.test/api/agents/helper"), {
      json: {
        content: "---\nname: helper\ndescription: API helper v2\nallowedIntents: []\n---\n\n## Identity\n\nHelp via API.\n",
      },
    });
    expect(response.status).toBe(200);
    body = JSON.parse(response.body);
    expect(body.created).toBe(false);
    expect(body.updated).toBe(true);
    expect(body.agent.description).toBe("API helper v2");

    response = await route("PUT", new URL("http://local.test/api/automations/daily"), {
      json: { agent: "helper", schedule: "manual", prompt: "Say hi." },
    });
    expect(response.status).toBe(200);
    body = JSON.parse(response.body);
    expect(body.created).toBe(true);
    expect(body.updated).toBe(false);
    expect(body.automation.name).toBe("daily");
    expect(body.path).toContain("daily.md");
    expect(body.etag).toBeTruthy();
    const rawMarkdown = body.automation.rawMarkdown;

    response = await route("PUT", new URL("http://local.test/api/automations/daily"), {
      json: { agent: "helper", schedule: "manual", prompt: "Say hi." },
    });
    expect(response.status).toBe(200);
    body = JSON.parse(response.body);
    expect(body.created).toBe(false);
    expect(body.updated).toBe(true);
    expect(body.automation.rawMarkdown).toBe(rawMarkdown);

    response = await route("PUT", new URL("http://local.test/api/automations/bad"), {
      json: { agent: "helper", schedule: "not cron", prompt: "Say hi." },
    });
    expect(response.status).toBe(400);
    body = JSON.parse(response.body);
    expect(body.code).toBe("VALIDATION_FAILED");
    expect(body.fields.some((field: { field: string }) => field.field === "schedule")).toBe(true);
  });
});

test("JSON API supports one-shot automation setup", async () => {
  await withTempHome(async () => {
    const { route } = await import("../../packages/web/dist/routes.js");

    let response = await route("POST", new URL("http://local.test/api/setup/automation"), {
      json: {
        agent: {
          name: "helper",
          content: "---\nname: helper\ndescription: Setup helper\nallowedIntents: []\n---\n\n## Identity\n\nHelp via setup.\n",
        },
        automation: { name: "daily", schedule: "manual", prompt: "Say hi." },
        installCron: false,
        runNow: false,
      },
    });
    expect(response.status).toBe(200);
    let body = JSON.parse(response.body);
    expect(body.agent.created).toBe(true);
    expect(body.automation.created).toBe(true);
    expect(body.automation.automation.agent).toBe("helper");
    expect(body.warnings).toEqual([]);

    response = await route("POST", new URL("http://local.test/api/setup/automation"), {
      json: {
        agent: {
          name: "helper",
          content: "---\nname: helper\ndescription: Setup helper v2\nallowedIntents: []\n---\n\n## Identity\n\nHelp via setup.\n",
        },
        automation: { name: "daily", schedule: "manual", prompt: "Say hello." },
      },
    });
    expect(response.status).toBe(200);
    body = JSON.parse(response.body);
    expect(body.agent.updated).toBe(true);
    expect(body.automation.updated).toBe(true);
    expect(body.automation.automation.prompt).toBe("Say hello.");
  });
});

test("JSON API returns automation status with cron and recent run summaries", async () => {
  await withTempHome(async (tempHome) => {
    const previousCrontabFile = process.env.JUMPYGOATHQ_CRONTAB_FILE;
    const crontabFile = path.join(tempHome, "crontab.txt");
    process.env.JUMPYGOATHQ_CRONTAB_FILE = crontabFile;
    try {
      const { route } = await import("../../packages/web/dist/routes.js");

      let response = await route("PUT", new URL("http://local.test/api/agents/helper"), {
        json: {
          content: "---\nname: helper\ndescription: Status helper\nallowedIntents: [web.search, notify.email]\n---\n\n## Identity\n\nHelp via status.\n",
        },
      });
      expect(response.status).toBe(200);

      response = await route("PUT", new URL("http://local.test/api/automations/daily"), {
        json: {
          agent: "helper",
          schedule: "0 * * * *",
          prompt: "Search and report.",
          web: { search: { enabled: true, connector: "firecrawl" } },
          notify: { email: { enabled: true, connector: "resend", to: "ops@example.com" } },
        },
      });
      expect(response.status).toBe(200);
      await seedRuns(tempHome);
      await import("node:fs/promises").then(({ writeFile }) => writeFile(crontabFile, "# jumpygoathq:start daily\n# helper via jumpyGoatHq\n0 * * * * pnpm runner daily\n# jumpygoathq:end daily\n", "utf8"));

      response = await route("GET", new URL("http://local.test/api/automations/daily/status?limit=1"));
      expect(response.status).toBe(200);
      let status = JSON.parse(response.body).status;
      expect(status.automation.name).toBe("daily");
      expect(status.cron.installed).toBe(true);
      expect(status.connectors.web.search.connector).toBe("firecrawl");
      expect(status.connectors.notify.email.connector).toBe("resend");
      expect(status.recentRuns).toHaveLength(1);
      expect(status.recentRuns[0].id).toBe("run-failed");
      expect(status.recentRuns[0].traceText).toBeUndefined();
      expect(status.recentRuns[0].errorPreview).toBe("Failed summary");
      expect(status.recentRuns[0].connectorActions.count).toBe(1);
      expect(status.warnings).toContain("Recent runs include failures.");

      await import("node:fs/promises").then(({ writeFile }) => writeFile(crontabFile, "", "utf8"));
      response = await route("GET", new URL("http://local.test/api/automations/daily/status?limit=5"));
      expect(response.status).toBe(200);
      status = JSON.parse(response.body).status;
      expect(status.cron.installed).toBe(false);
      expect(status.recentRuns.map((run: { id: string }) => run.id)).toEqual(["run-failed", "run-ok"]);
      expect(status.warnings).toContain("Cron schedule is not installed in the user crontab.");
    } finally {
      if (previousCrontabFile === undefined) delete process.env.JUMPYGOATHQ_CRONTAB_FILE;
      else process.env.JUMPYGOATHQ_CRONTAB_FILE = previousCrontabFile;
    }
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
