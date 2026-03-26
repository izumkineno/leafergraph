import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const PREVIEW_PORT = 4173;
const PREVIEW_BASE_URL = `http://127.0.0.1:${PREVIEW_PORT}`;
const EDITOR_ROOT = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }]
  ],
  outputDir: "test-results",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: PREVIEW_BASE_URL,
    viewport: { width: 1440, height: 960 },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "preview",
      testMatch: /preview[\\/].*\.e2e\.ts$/
    },
    {
      name: "python",
      testMatch: /python[\\/].*\.e2e\.ts$/
    }
  ],
  webServer: {
    command: `bun run preview -- --host 127.0.0.1 --port ${PREVIEW_PORT}`,
    url: PREVIEW_BASE_URL,
    cwd: EDITOR_ROOT,
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
