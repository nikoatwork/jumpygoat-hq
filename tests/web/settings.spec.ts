import { expect, test } from "@playwright/test";

test("settings page renders model settings and usage summary without invoking Pi", async ({ page }) => {
  await page.goto("/settings");

  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.locator("body")).toContainText("settings.yml");
  await expect(page.getByRole("heading", { name: "Model profiles" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Usage by model" })).toBeVisible();
  await expect(page.locator("body")).toContainText(/No usage emitted by Pi has been recorded yet|Reported cost/);
});
