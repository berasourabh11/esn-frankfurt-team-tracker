import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

/**
 * E2E tests run against a production build (`next build && next start`).
 * Tests pin the browser clock so date grouping is deterministic.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    timezoneId: "Europe/Berlin",
    locale: "en-GB",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: baseURL,
    // Demo mode, even when .env.local points at the API (process env wins over .env files).
    env: { EVENTS_API_BASE_URL: "", NEXT_PUBLIC_API_BASE_URL: "" },
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
