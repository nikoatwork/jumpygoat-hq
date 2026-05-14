import { expect, test } from "@playwright/test";

test("dashboard renders core navigation and run summary", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Automations" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Agents" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Schedule" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Runs" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(page.getByText("Automations:")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent runs" })).toBeVisible();
});

test("automations page renders template empty state or local automations", async ({ page }) => {
  await page.goto("/automations");

  await expect(page.getByRole("heading", { name: "Automations" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create automation" })).toBeVisible();
  await expect(page.locator("body")).toContainText(/No automations found|Cron installed/);
});

test("schedule page renders read-only agenda", async ({ page }) => {
  await page.goto("/schedule");

  await expect(page.getByRole("heading", { name: "Schedule", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming agenda" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scheduled run summary" })).toBeVisible();
  await expect(page.locator("body")).toContainText(/No automations found|Automation/);
});

test("tasks kanban column new-task links prefill status", async ({ page }) => {
  await page.goto("/tasks");

  await page.locator('.kanban-column[data-status="ready"]').getByRole("link", { name: "+ new task" }).click();

  await expect(page).toHaveURL(/\/tasks\/new\?status=ready/);
  await expect(page.getByLabel("Status")).toHaveValue("ready");
});

test("runs page renders either empty state or run table", async ({ page }) => {
  await page.goto("/runs");

  await expect(page.getByRole("heading", { name: "Runs" })).toBeVisible();
  await expect(page.locator("body")).toContainText(/No runs found|Automation/);
});
