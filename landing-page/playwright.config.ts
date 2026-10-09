import { defineConfig, devices } from '@playwright/test'

/**
 * Hydration smoke test for the prerendered (SSG) landing page: the static HTML must
 * hydrate without React warnings/errors in a real browser, on desktop, iPhone, Android and an
 * iPad (spec 17). Runs against `vite preview` of the production build; bundle budgets are
 * checked on the same build.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4174',
    // Spec 21: the build has a test Google Ads ID, so the cookie banner exists; every test except
    // e2e/google-ads.spec.ts starts with the decision "refused" so the banner never covers the page.
    storageState: { cookies: [{ name: 'ag_consent', value: 'ads=0', domain: 'localhost', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' }], origins: [] },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: { VITE_GOOGLE_ADS_ID: 'AW-TEST', VITE_GOOGLE_ADS_SIGNUP_LABEL: 'signup-test', VITE_GOOGLE_ADS_PURCHASE_LABEL: 'purchase-test' },
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone-14', use: { ...devices['iPhone 14'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
    { name: 'ipad', use: { ...devices['iPad (gen 7)'] } },
  ],
})
