import { expect, type Page, test } from "@playwright/test";

async function expectActiveNav(page: Page, name: string) {
  await expect(page.locator('a[aria-current="page"]')).toHaveAccessibleName(name);
}

async function expectNoUnlabeledControls(page: Page) {
  const unlabeled = await page.locator("input:not([type='hidden']), select, textarea").evaluateAll((controls) => controls
    .filter((control) => {
      const element = control as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      return !element.labels?.length && !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby");
    })
    .map((control) => control.outerHTML.slice(0, 120)));
  expect(unlabeled).toEqual([]);
}

async function expectActionTargetsAtLeast(page: Page, minSize = 44) {
  const smallTargets = await page.locator(".button-link:visible, button:visible, .nav-link:visible, summary:visible, .inline-actions a:visible, .card-actions a:visible").evaluateAll((controls, minimum) => controls
    .map((control) => {
      const rect = control.getBoundingClientRect();
      return { text: (control.textContent || control.getAttribute("aria-label") || "").trim(), width: rect.width, height: rect.height };
    })
    .filter((target) => target.width > 0 && target.height > 0 && (target.width < Number(minimum) || target.height < Number(minimum))), minSize);
  expect(smallTargets).toEqual([]);
}

test("overview renders core sidebar navigation and run summary", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expectActiveNav(page, "Overview");
  await expect(page.getByRole("link", { name: "All automations", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Agents", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Boards", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Schedule", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Runs", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.locator("svg.app-icon").first()).toBeVisible();
  await expect(page.locator("details.nav-group", { hasText: "Work" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "At a glance" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
});

test("automations page renders template empty state or local automations", async ({ page }) => {
  await page.goto("/automations");

  await expect(page.getByRole("heading", { name: "Automations" })).toBeVisible();
  await expectActiveNav(page, "All automations");
  await expect(page.getByRole("link", { name: "Create automation" })).toBeVisible();
  await expect(page.locator("body")).toContainText(/No automations found|Cron installed/);
});

test("schedule page renders read-only agenda", async ({ page }) => {
  await page.goto("/schedule");

  await expect(page.getByRole("heading", { name: "Schedule", exact: true })).toBeVisible();
  await expectActiveNav(page, "Schedule");
  await expect(page.getByRole("heading", { name: "Upcoming agenda" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scheduled run summary" })).toBeVisible();
  await expect(page.locator("body")).toContainText(/No automations found|Automation/);
});

test("boards page renders template empty state or local boards", async ({ page }) => {
  await page.goto("/boards");

  await expect(page.getByRole("heading", { name: "Boards" })).toBeVisible();
  await expectActiveNav(page, "Boards");
  await expect(page.getByRole("link", { name: "Create board" })).toBeVisible();
  await expect(page.locator("body")).toContainText(/No boards found|Default agent/);
});

test("agents page renders reusable agent bundles", async ({ page }) => {
  await page.goto("/agents");

  await expect(page.getByRole("heading", { name: "Agents", exact: true })).toBeVisible();
  await expectActiveNav(page, "Agents");
  await expect(page.getByRole("link", { name: "Create agent" })).toBeVisible();
  await expect(page.locator("body")).toContainText(/No agents yet|Agent roster|How to think about agents/);
});

test("tasks kanban column new-task links prefill status", async ({ page }) => {
  await page.goto("/tasks");

  await expectActiveNav(page, "Tasks");
  await expect(page.locator('.kanban-column[data-status="not-yet"]')).toBeVisible();
  await expect(page.locator('.kanban-column[data-status="working-on-it"]')).toBeVisible();
  await page.locator('.kanban-column[data-status="ready"]').getByRole("link", { name: "+ new task" }).click();

  await expect(page).toHaveURL(/\/tasks\/new\?status=ready/);
  await expect(page.getByLabel("Status")).toHaveValue("ready");
});

test("sidebar groups can collapse with accessible details behavior", async ({ page }) => {
  await page.goto("/");

  const workGroup = page.locator("details.nav-group", { hasText: "Work" });
  await expect(workGroup).toHaveJSProperty("open", true);
  await workGroup.getByText("Work").click();
  await expect(workGroup).toHaveJSProperty("open", false);
});

test("tasks kanban can focus one status with status query param", async ({ page }) => {
  await page.goto("/tasks?status=working-on-it");

  await expect(page.getByText("Focused on working on it")).toBeVisible();
  await expect(page.locator('.kanban-column.focused[data-status="working-on-it"]')).toBeVisible();
  await expect(page.locator(".kanban-column-collapsed")).toHaveCount(3);
  await expect(page.getByRole("link", { name: "All columns" })).toBeVisible();
});

test("runs page renders either empty state or run table", async ({ page }) => {
  await page.goto("/runs");

  await expect(page.getByRole("heading", { name: "Runs" })).toBeVisible();
  await expectActiveNav(page, "Runs");
  await expect(page.locator("body")).toContainText(/No runs found|Source/);
});

test("docs page renders local markdown source with docs navigation", async ({ page }) => {
  await page.goto("/docs");

  await expect(page.getByRole("heading", { name: "Docs", exact: true })).toBeVisible();
  await expectActiveNav(page, "Docs");
  await expect(page.getByRole("navigation", { name: "Documentation pages" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Deploy jumpyGoatHq on your own server/ })).toBeVisible();
  await expect(page.locator("pre.docs-source")).toContainText("# Deploy jumpyGoatHq on your own server");

  await page.getByRole("link", { name: /packages\/web/ }).click();
  await expect(page).toHaveURL(/file=packages%2Fweb%2FDOCS\.md/);
  await expect(page.locator("pre.docs-source")).toContainText("# packages/web");
});

test("core forms keep controls labeled and action targets large", async ({ page }) => {
  for (const path of ["/", "/tasks", "/automations/new", "/agents/new", "/settings", "/runs", "/docs"]) {
    await page.goto(path);
    await expectNoUnlabeledControls(page);
    await expectActionTargetsAtLeast(page);
  }
});

test("mobile pages avoid page-level horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/tasks", "/automations", "/agents/new", "/settings", "/runs", "/docs"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }
});
