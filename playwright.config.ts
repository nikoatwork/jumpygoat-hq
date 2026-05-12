import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYWRIGHT_PORT || process.env.PORT || "3123");
const host = process.env.PLAYWRIGHT_HOST || "127.0.0.1";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://${host}:${port}`;

export default defineConfig({
  testDir: "./tests/web",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `HOST=${host} PORT=${port} pnpm dev:web`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
