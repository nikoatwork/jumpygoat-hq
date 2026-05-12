import { expect, test } from "@playwright/test";

test("dashboard renders core navigation and run summary", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Automations" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Skills" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Runs" })).toBeVisible();
  await expect(page.getByText("Automations:")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent runs" })).toBeVisible();
});

test("automations page renders template empty state or local automations", async ({ page }) => {
  await page.goto("/automations");

  await expect(page.getByRole("heading", { name: "Automations" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create automation" })).toBeVisible();
  await expect(page.locator("body")).toContainText(/No automations found|Cron installed/);
});

test("runs page renders either empty state or run table", async ({ page }) => {
  await page.goto("/runs");

  await expect(page.getByRole("heading", { name: "Runs" })).toBeVisible();
  await expect(page.locator("body")).toContainText(/No runs found|Automation/);
});
