import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";


test.describe("cron expansion", () => {
  test("expands daily schedules", async () => {
    const { nextOccurrences } = await import("../../packages/web/dist/schedule.js");
    const result = nextOccurrences("30 9 * * *", new Date(2026, 0, 1, 9, 0), new Date(2026, 0, 3, 10, 0), 5);
    expect(result.warning).toBeUndefined();
    expect(result.occurrences.map(parts)).toEqual([
      [2026, 0, 1, 9, 30],
      [2026, 0, 2, 9, 30],
      [2026, 0, 3, 9, 30],
    ]);
  });

  test("expands weekly schedules", async () => {
    const { nextOccurrences } = await import("../../packages/web/dist/schedule.js");
    const result = nextOccurrences("15 8 * * 1", new Date(2026, 0, 4, 0, 0), new Date(2026, 0, 12, 0, 0), 5);
    expect(result.occurrences.map(parts)).toEqual([
      [2026, 0, 5, 8, 15],
    ]);
  });

  test("expands hourly list/range/step schedules", async () => {
    const { nextOccurrences } = await import("../../packages/web/dist/schedule.js");
    const result = nextOccurrences("0,30 9-10/1 * * *", new Date(2026, 0, 1, 8, 59), new Date(2026, 0, 1, 11, 0), 10);
    expect(result.occurrences.map(parts)).toEqual([
      [2026, 0, 1, 9, 0],
      [2026, 0, 1, 9, 30],
      [2026, 0, 1, 10, 0],
      [2026, 0, 1, 10, 30],
    ]);
  });

  test("supports wildcard steps", async () => {
    const { nextOccurrences } = await import("../../packages/web/dist/schedule.js");
    const result = nextOccurrences("*/15 * * * *", new Date(2026, 0, 1, 0, 0), new Date(2026, 0, 1, 0, 46), 10);
    expect(result.occurrences.map(parts)).toEqual([
      [2026, 0, 1, 0, 15],
      [2026, 0, 1, 0, 30],
      [2026, 0, 1, 0, 45],
    ]);
  });

  test("returns no occurrences for valid no-match windows", async () => {
    const { nextOccurrences } = await import("../../packages/web/dist/schedule.js");
    const result = nextOccurrences("0 0 31 2 *", new Date(2026, 1, 1, 0, 0), new Date(2026, 1, 28, 23, 59), 10);
    expect(result.warning).toBeUndefined();
    expect(result.occurrences).toEqual([]);
  });

  test("returns warnings for malformed expressions", async () => {
    const { nextOccurrences, parseCronExpression } = await import("../../packages/web/dist/schedule.js");
    expect(parseCronExpression("not cron").ok).toBe(false);
    const result = nextOccurrences("61 * * * *", new Date(2026, 0, 1), new Date(2026, 0, 2), 10);
    expect(result.occurrences).toEqual([]);
    expect(result.warning).toContain("minute");
  });
});

test("schedule route renders a temp AgentHQ home without mutating cron", async () => {
  const previousHome = process.env.AGENTHQ_HOME;
  const tempHome = await mkdtemp(path.join(os.tmpdir(), "agenthq-schedule-"));
  try {
    process.env.AGENTHQ_HOME = tempHome;
    await mkdir(path.join(tempHome, "agents", "analyst"), { recursive: true });
    await mkdir(path.join(tempHome, "automations"), { recursive: true });
    await writeFile(path.join(tempHome, "agents", "analyst", "AGENT.md"), "---\nname: analyst\ndescription: Market analyst\n---\n\nInstructions\n", "utf8");
    await writeFile(path.join(tempHome, "automations", "morning-report.md"), "---\nagent: analyst\nschedule: '30 9 * * *'\n---\n\nReport.\n", "utf8");
    await writeFile(path.join(tempHome, "automations", "manual-idea.md"), "---\nagent: analyst\nschedule: manual\n---\n\nThink.\n", "utf8");

    const { route } = await import("../../packages/web/dist/routes.js");
    const response = await route("GET", new URL("http://local.test/schedule"));
    expect(response.status).toBe(200);
    expect(response.body).toContain("Schedule");
    expect(response.body).toContain("morning-report");
    expect(response.body).toContain("manual-idea");
    expect(response.body).toContain("Market analyst");
  } finally {
    if (previousHome === undefined) delete process.env.AGENTHQ_HOME;
    else process.env.AGENTHQ_HOME = previousHome;
    await rm(tempHome, { recursive: true, force: true });
  }
});

function parts(date: Date): [number, number, number, number, number] {
  return [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes()];
}
