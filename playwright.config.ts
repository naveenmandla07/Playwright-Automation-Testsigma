/// <reference types="node" />

import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './Naveen_Testsigma',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use */
  reporter: 'html',

  /* Shared settings for all the projects */
  use: {
    /* Base URL to use in actions like await page.goto('') */
    baseURL: process.env.TESTSIGMA_BASE_URL ?? 'https://app.testsigma.com/ui/',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
  },

  /* Configure Chrome browser only */
  projects: [
    {
      name: 'chromium',
      testIgnore: /Create Project and select the Created Project|Test Data_TDP/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      /* The account's current project is shared server-side: these tests either switch it or read data scoped to it,
         so run them one at a time. */
      name: 'chromium-projects',
      testMatch: /(Create Project and select the Created Project|Test Data_TDP)\/.*\.spec\.ts/,
      workers: 1,
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});