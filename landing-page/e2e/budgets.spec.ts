import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { gzipSync } from 'zlib'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

/**
 * Spec 17: performance budgets measured on the production build (`npm run build` runs before the
 * Playwright web server starts). The build is the same for every device, so this runs once.
 */
const HERE = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(HERE, '../dist')
const KB = 1024

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'desktop-chrome', 'build output is device-independent')
})

const gzipSize = (file: string) => gzipSync(readFileSync(file), { level: 9 }).length

test('[AC-PERF-001] the home page loads at most 110 KB of gzipped JS and no axios', () => {
  const html = readFileSync(join(DIST, 'index.html'), 'utf-8')
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g), ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g)].map((m) => m[1])
  expect(scripts.length).toBeGreaterThan(0)
  const total = scripts.reduce((sum, src) => sum + gzipSize(join(DIST, src)), 0)
  expect(total, `home JS: ${(total / KB).toFixed(1)} KB gzip (${scripts.join(', ')})`).toBeLessThanOrEqual(110 * KB)

  for (const file of readdirSync(join(DIST, 'assets')).filter((f) => f.endsWith('.js'))) {
    expect(readFileSync(join(DIST, 'assets', file), 'utf-8'), file).not.toContain('AxiosError')
  }
})

test('[AC-PERF-004] icons and logos stay small on the landing page and in the app', () => {
  for (const dir of [resolve(HERE, '../public'), resolve(HERE, '../../frontend/public')]) {
    expect(statSync(join(dir, 'favicon.ico')).size, `${dir}/favicon.ico`).toBeLessThanOrEqual(16 * KB)
    expect(statSync(join(dir, 'logo.webp')).size, `${dir}/logo.webp`).toBeLessThanOrEqual(12 * KB)
    expect(existsSync(join(dir, 'logo.png')), `${dir}/logo.png (JSON-LD, apple-touch-icon)`).toBe(true)
  }
  expect(existsSync(resolve(HERE, '../public/og-image.png'))).toBe(true)
})
