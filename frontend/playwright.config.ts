import { defineConfig, devices } from '@playwright/test'

/**
 * Browser tests for the app frontend on real engines:
 *   - Desktop Chrome / Desktop Safari (WebKit)
 *   - iPhone 14 (WebKit, touch, iOS user agent)
 *   - Pixel 7 (Chromium, Android user agent)
 *   - iPad (gen 7) in portrait (WebKit, 810 px, iPadOS) and Galaxy Tab S4 (Chromium, Android tablet)
 *
 * The API is mocked with page.route(), so no backend is required. The app is
 * served by `vite preview` from a production build (see webServer below).
 */
export default defineConfig({
  testDir: './e2e',
  // The full-stack test needs the real backend – see playwright.fullstack.config.ts.
  testIgnore: '**/fullstack/**',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    acceptDownloads: true,
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { VITE_API_URL: '/api', VITE_GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com' },
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'desktop-safari', use: { ...devices['Desktop Safari'] } },
    { name: 'iphone-14', use: { ...devices['iPhone 14'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
    { name: 'ipad', use: { ...devices['iPad (gen 7)'] } },
    { name: 'galaxy-tab', use: { ...devices['Galaxy Tab S4'] } },
  ],
})
