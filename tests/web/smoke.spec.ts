import { expect, type Page, test } from "@playwright/test";

async function expectActiveNav(page: Page, name: string) {
  await expect(page.locator('a[aria-current="page"]')).toHaveAccessibleName(name);
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
