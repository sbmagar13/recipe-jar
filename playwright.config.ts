import { defineConfig, devices } from '@playwright/test'

// E2E against the running dev server (which includes the /api/proxy middleware).
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5199',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // iOS Safari engine, the other half of the audience.
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    // A cheap-ish Android phone and an iPhone, real touch + viewport.
    { name: 'android', use: { ...devices['Pixel 7'] } },
    { name: 'iphone', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'npm run dev -- --port 5199',
    url: 'http://localhost:5199',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
