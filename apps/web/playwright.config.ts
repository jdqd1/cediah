import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: ".map-test-results",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.MAP_E2E_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: process.env.MAP_E2E_URL
    ? undefined
    : [
        ...(process.env.MAP_E2E_REAL === "true"
          ? [
              {
                command:
                  "pnpm --config.verify-deps-before-run=false --filter @cediah/api test:map-server",
                url: "http://127.0.0.1:4100/v1/guided-learning/map",
                timeout: 120_000,
                reuseExistingServer: !process.env.CI,
                env: { NODE_ENV: "test", MAP_E2E_TEST_SERVER: "true" },
              },
            ]
          : []),
        {
          command: "pnpm --config.verify-deps-before-run=false dev",
          url: "http://localhost:3000/visual-fixtures/mapa",
          timeout: 120_000,
          reuseExistingServer: !process.env.CI,
          env:
            process.env.MAP_E2E_REAL === "true"
              ? { API_BASE_URL: "http://127.0.0.1:4100" }
              : {},
        },
      ],
});
