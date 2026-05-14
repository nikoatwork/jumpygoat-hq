import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  CoreError,
  automationMarkdown,
  createAgent,
  createAutomation,
  createBoard,
  createTask,
  deleteAgent,
  getAutomation,
  updateAutomation,
} from "../src/index.js";

const home = await mkdtemp(path.join(os.tmpdir(), "jumpygoathq-core-test-"));
process.env.JUMPYGOATHQ_HOME = home;

try {
  await assert.rejects(
    () => createAgent({ name: "Bad Name", content: "---\nname: bad\n---\n" }),
    (error) => error instanceof CoreError && error.code === "VALIDATION_FAILED",
  );

  await createAgent({
    name: "helper",
    content: "---\nname: helper\ndescription: Test helper\nallowedIntents: []\n---\n\n## Identity\n\nHelp with tests.\n",
  });

  assert.equal(
    automationMarkdown({ name: "daily", agent: "helper", schedule: "manual", prompt: "Say hi." }),
    '---\nagent: "helper"\nschedule: "manual"\n---\n\nSay hi.\n',
  );

  await createAutomation({ name: "daily", agent: "helper", schedule: "manual", prompt: "Say hi." });
  const automation = await getAutomation("daily", { includeRaw: true });
  assert.equal(automation.agent, "helper");
  assert.equal(automation.prompt, "Say hi.");
  assert.ok(automation.etag);
  assert.match(automation.rawMarkdown || "", /Say hi\./);

  await assert.rejects(
    () => updateAutomation("daily", { name: "daily", agent: "helper", schedule: "manual", prompt: "Changed.", ifMatch: 'W/"bogus"' }),
    (error) => error instanceof CoreError && error.code === "PRECONDITION_FAILED",
  );

  await assert.rejects(
    () => deleteAgent("helper"),
    (error) => error instanceof CoreError && error.code === "CONFLICT" && /used by automation/.test(error.message),
  );

  await createBoard({ id: "ops", name: "Ops", description: "Ops board", body: "# Ops\n" });
  const task = await createTask({ id: "first-task", board: "ops", title: "First task", status: "not-yet", priority: "normal", body: "Do it." });
  assert.equal(task.id, "first-task");
  assert.equal(task.board, "ops");
} finally {
  await rm(home, { recursive: true, force: true });
}
