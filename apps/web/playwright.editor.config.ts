import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: { timeout: 10_000 },
  fullyParallel: false,
  outputDir: ".editor-test-results",
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { height: 900, width: 1440 } } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { height: 844, width: 390 } } },
  ],
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report/editor" }]],
  testDir: "./tests/e2e",
  testMatch: /route-editor\.spec\.ts/,
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm --filter @cediah/web exec next dev --hostname 127.0.0.1 --port 3100",
    cwd: "../..",
    env: { NODE_ENV: "development" },
    reuseExistingServer: false,
    timeout: 120_000,
    url: "http://127.0.0.1:3100/visual-fixtures/editor-rutas",
  },
  workers: 1,
});
