import { defineConfig } from '@playwright/test';
import { cfg } from './lib/env';

// Test titles are prefixed "[browser test against QA]". These tests do NOT prove the released native apps work.
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results/artifacts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: './test-results/html', open: 'never' }], ['json', { outputFile: './test-results/results.json' }]],
  globalSetup: './lib/global-setup.ts',
  use: {
    baseURL: cfg.baseUrl,
    screenshot: 'only-on-failure',
    trace: 'off', // traces would contain request headers (keys, sessions); never record them,
    video: 'off',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'desktop-chromium', use: { viewport: { width: 1280, height: 900 } } },
    // The phone-sized browser runs only the public-page and privacy tests; the account journey runs once (desktop) so it does not create duplicates.
    { name: 'phone-chromium', testMatch: /0[12]_.*\.spec\.ts/, use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
