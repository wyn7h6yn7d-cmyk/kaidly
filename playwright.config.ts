import { defineConfig, devices } from "@playwright/test";
import { localSupabaseEnv } from "./scripts/local-supabase.mjs";

/**
 * End-to-end tests against the LOCAL Supabase stack only (npm run db:start first).
 * A dedicated dev server on port 3100 is started against the local stack.
 *
 * Projects: every test runs on desktop; tests tagged @responsive also run on a phone
 * (375 px) and a tablet (768 px) viewport.
 */
const local = localSupabaseEnv();
process.env.E2E_API_URL = local.API_URL;
process.env.E2E_SERVICE_ROLE_KEY = local.SERVICE_ROLE_KEY;
process.env.E2E_MAILPIT_URL = local.MAILPIT_URL ?? local.INBUCKET_URL ?? "";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "et-EE",
    timezoneId: "Europe/Tallinn",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    {
      name: "tablet",
      grep: /@responsive/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
    {
      name: "mobile",
      grep: /@responsive/,
      use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: {
    command: `node scripts/dev-local.mjs ${PORT}`,
    url: `http://localhost:${PORT}/auth/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
  },
});
