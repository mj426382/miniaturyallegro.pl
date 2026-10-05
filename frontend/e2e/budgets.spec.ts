import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync } from 'fs'
import { gzipSync } from 'zlib'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

/**
 * Spec 17, AC-PERF-003: bundle budgets on the production build (the Playwright web server runs
 * `npm run build` first). The build is device-independent, so this runs on one project.
 */
const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../dist')
const KB = 1024
const gzipSize = (file: string) => gzipSync(readFileSync(file), { level: 9 }).length

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'desktop-chrome', 'build output is device-independent')
})

test('[AC-PERF-003] the entry JS stays under 150 KB gzip and screens behind login are split out', () => {
  const html = readFileSync(join(DIST, 'index.html'), 'utf-8')
  const entry = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g), ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g)].map((m) => m[1])
  expect(entry.length).toBeGreaterThan(0)
  const entrySize = entry.reduce((sum, src) => sum + gzipSize(join(DIST, src)), 0)
  expect(entrySize, `entry JS ${(entrySize / KB).toFixed(1)} KB gzip`).toBeLessThanOrEqual(150 * KB)

  const chunks = readdirSync(join(DIST, 'assets')).filter((f) => f.endsWith('.js'))
  for (const chunk of chunks) {
    expect(gzipSize(join(DIST, 'assets', chunk)), chunk).toBeLessThanOrEqual(120 * KB)
  }
  for (const screen of ['Dashboard', 'Generate', 'Gallery', 'Credits', 'Account', 'Admin', 'BulkUpload']) {
    expect(
      chunks.some((c) => c.startsWith(`${screen}-`)),
      `${screen} has its own chunk`,
    ).toBe(true)
  }
})
