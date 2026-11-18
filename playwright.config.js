import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5174",
    viewport: { width: 1440, height: 1050 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  reporter: "list",
  timeout: 30000,
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
    timeout: 60000,
    // The default is SIGKILL, which would skip dropping the disposable database.
    gracefulShutdown: { signal: "SIGTERM", timeout: 5000 },
  },
});
