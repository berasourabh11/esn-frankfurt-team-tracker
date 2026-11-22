import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests with the real API (backend/) and a fresh in-memory
 * database seeded with demo data: real sign-in, member management and data
 * saved by the API. Run with `npm run test:e2e:api`.
 *
 * The frontend is built into .next-api with NEXT_PUBLIC_API_BASE_URL set,
 * so it doesn't disturb the regular demo-mode build in .next.
 */
const WEB_PORT = 3200;
const API_PORT = 8788;
const API = `http://localhost:${API_PORT}`;

export default defineConfig({
  testDir: "./e2e-api",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    timezoneId: "Europe/Berlin",
    locale: "en-GB",
  },
  projects: [{ name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm --prefix backend run start",
      url: `${API}/`,
      env: {
        DB_FILE: ":memory:",
        PORT: String(API_PORT),
        ALLOWED_ORIGINS: `http://localhost:${WEB_PORT}`,
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `node e2e-api/wait-for.mjs ${API}/ && npm run build && npm run start -- --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      env: {
        NEXT_DIST_DIR: ".next-api",
        EVENTS_API_BASE_URL: API,
        NEXT_PUBLIC_API_BASE_URL: API,
        NEXT_PUBLIC_SITE_URL: `http://localhost:${WEB_PORT}`,
      },
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
