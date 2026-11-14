import { defineConfig } from "@playwright/test";

// Browser tests run against a local `next dev` server wired to the in-memory mock Supabase
// (e2e/mock-supabase.mjs). No network, no real project, no secrets. Analytics are off.
// Chrome: uses PLAYWRIGHT_CHROME_PATH, else /usr/bin/google-chrome, else Playwright's own download.
const MOCK_PORT = 54321;
const APP_PORT = 3100;
const chrome = process.env.PLAYWRIGHT_CHROME_PATH || (process.platform === "linux" ? "/usr/bin/google-chrome" : undefined);

export default defineConfig({
  testDir: "./e2e",
  testMatch: /.*\.spec\.ts/,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    launchOptions: { executablePath: chrome, args: ["--no-sandbox", "--no-proxy-server"] },
    trace: "off",
  },
  webServer: [
    { command: "node e2e/mock-supabase.mjs", url: `http://127.0.0.1:${MOCK_PORT}/__mock/unhandled`, reuseExistingServer: true, timeout: 30_000 },
    {
      command: `npx next dev -p ${APP_PORT} -H 127.0.0.1`,
      url: `http://127.0.0.1:${APP_PORT}/login`,
      reuseExistingServer: true,
      timeout: 240_000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key",
        NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${APP_PORT}`,
        NEXT_PUBLIC_ANALYTICS_MODE: "off",
        NEXT_TELEMETRY_DISABLED: "1",
        NEXT_FONT_GOOGLE_MOCKED_RESPONSES: `${process.cwd()}/e2e/fixtures/google-fonts-mock.cjs`,
      },
    },
  ],
});
