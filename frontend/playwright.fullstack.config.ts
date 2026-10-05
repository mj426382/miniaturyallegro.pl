import { defineConfig, devices } from '@playwright/test'

/**
 * Full-stack browser test (spec 17, AC-E2E-001..003): the production build of the app served by
 * `vite preview`, proxying /api to the real Nest backend started from backend/test/e2e-server.ts
 * on a throw-away local database. Only the AI provider and the mailbox are fakes.
 *
 *   docker compose -f ../infra/docker-compose.test.yml up -d
 *   npm run test:e2e:fullstack
 */
const BACKEND_PORT = 3999
const FRONTEND_PORT = 4175
const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5437/allgrafika_e2e_test?schema=public'

export default defineConfig({
  testDir: './e2e/fullstack',
  timeout: 60_000,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm --prefix ../backend run e2e:server',
      url: `http://localhost:${BACKEND_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { E2E_DATABASE_URL, E2E_PORT: String(BACKEND_PORT), E2E_FRONTEND_URL: `http://localhost:${FRONTEND_PORT}` },
    },
    {
      command: `npm run build && npx vite preview --port ${FRONTEND_PORT} --strictPort`,
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { VITE_API_URL: '/api', VITE_PROXY_TARGET: `http://localhost:${BACKEND_PORT}`, VITE_GOOGLE_CLIENT_ID: 'e2e-client-id.apps.googleusercontent.com' },
    },
  ],
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone-14', use: { ...devices['iPhone 14'] } },
  ],
})
