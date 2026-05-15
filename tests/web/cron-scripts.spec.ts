import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { expect, test } from "@playwright/test";

const execFileAsync = promisify(execFile);

type TempCron = {
  tempHome: string;
  crontabFile: string;
  runScript: (script: string, args?: string[]) => Promise<{ stdout: string; stderr: string }>;
};

async function withTempCron<T>(fn: (ctx: TempCron) => Promise<T>): Promise<T> {
  const tempHome = await mkdtemp(path.join(os.tmpdir(), "jumpygoathq-cron-scripts-"));
  const crontabFile = path.join(tempHome, "crontab.txt");
  const env = {
    ...process.env,
    JUMPYGOATHQ_HOME: tempHome,
    JUMPYGOATHQ_CRONTAB_FILE: crontabFile,
  };
  const runScript = async (script: string, args: string[] = []) => {
    const result = await execFileAsync("pnpm", ["--filter", "@jumpygoat-hq/runner", "exec", "tsx", `../../scripts/${script}`, ...args], {
      cwd: process.cwd(),
      env,
      timeout: 30_000,
    });
    return { stdout: result.stdout, stderr: result.stderr };
  };

  try {
    return await fn({ tempHome, crontabFile, runScript });
  } finally {
    await rm(tempHome, { recursive: true, force: true });
  }
}

test("automation cron install and uninstall scripts execute under tsx", async () => {
  await withTempCron(async ({ tempHome, crontabFile, runScript }) => {
    await mkdir(path.join(tempHome, "automations"), { recursive: true });
    await writeFile(
      path.join(tempHome, "automations", "daily.md"),
      "---\nagent: helper\nschedule: '*/15 * * * *'\n---\n\nSay hello.\n",
      "utf8",
    );
    await writeFile(crontabFile, "MAILTO=ops@example.com\n", "utf8");

    const install = await runScript("install-cron.ts", ["daily"]);
    expect(install.stdout).toContain("Installed cron for automation: daily");

    const installed = await readFile(crontabFile, "utf8");
    expect(installed).toContain("MAILTO=ops@example.com");
    expect(installed).toContain("# jumpygoathq:start daily");
    expect(installed).toContain("*/15 * * * *");
    expect(installed).toContain("/bin/bash");
    expect(installed).toContain("cron-daily.sh");
    const cronScript = await readFile(path.join(tempHome, "data", "cron-daily.sh"), "utf8");
    expect(cronScript).toContain("pnpm runner daily");

    await runScript("install-cron.ts", ["daily"]);
    const reinstalled = await readFile(crontabFile, "utf8");
    expect(reinstalled.match(/# jumpygoathq:start daily/g)).toHaveLength(1);

    const uninstall = await runScript("uninstall-cron.ts", ["daily"]);
    expect(uninstall.stdout).toContain("Uninstalled cron for automation: daily");

    const uninstalled = await readFile(crontabFile, "utf8");
    expect(uninstalled).toContain("MAILTO=ops@example.com");
    expect(uninstalled).not.toContain("# jumpygoathq:start daily");
  });
});

test("task heartbeat cron install and uninstall scripts execute under tsx", async () => {
  await withTempCron(async ({ crontabFile, runScript }) => {
    await writeFile(crontabFile, "MAILTO=ops@example.com\n", "utf8");

    const install = await runScript("install-task-heartbeat-cron.ts", ["--schedule=*/30 * * * *", "--limit=2"]);
    expect(install.stdout).toContain("Installed task heartbeat cron: schedule=*/30 * * * * limit=2");

    const installed = await readFile(crontabFile, "utf8");
    expect(installed).toContain("# jumpygoathq:task-heartbeat:start");
    expect(installed).toContain("*/30 * * * *");
    expect(installed).toContain("/bin/bash");
    expect(installed).toContain("cron-task-heartbeat.sh");
    const cronScript = await readFile(path.join(path.dirname(crontabFile), "data", "cron-task-heartbeat.sh"), "utf8");
    expect(cronScript).toContain("pnpm dispatch:tasks --limit=2");

    const uninstall = await runScript("uninstall-task-heartbeat-cron.ts");
    expect(uninstall.stdout).toContain("Uninstalled task heartbeat cron.");

    const uninstalled = await readFile(crontabFile, "utf8");
    expect(uninstalled).toContain("MAILTO=ops@example.com");
    expect(uninstalled).not.toContain("# jumpygoathq:task-heartbeat:start");
  });
});
