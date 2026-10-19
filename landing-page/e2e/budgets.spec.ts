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

/** Home page JS: the entry script plus everything it imports statically (Vite's modulepreload graph). */
function homeScripts(): string[] {
  const html = readFileSync(join(DIST, 'index.html'), 'utf-8')
  const seen = new Set<string>()
  const queue = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g), ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g)].map((m) => m[1])
  while (queue.length) {
    const src = queue.shift()!
    if (seen.has(src)) continue
    seen.add(src)
    const code = readFileSync(join(DIST, src), 'utf-8')
    // static imports only: `import … from "./x.js"` / `import "./x.js"` (dynamic `import("./x.js")` is excluded)
    for (const m of code.matchAll(/(?:^|[;\s}])import\s*(?:[\w${},*\s]+from\s*)?["'](\.\/[^"']+\.js)["']/g)) queue.push(`/assets/${m[1].slice(2)}`)
  }
  return [...seen]
}

test('[AC-TOOL-008] the photo checker is a lazy chunk that the home page neither loads nor preloads', async ({ page }) => {
  const MARKER = 'data-photo-checker-tool'
  const chunks = readdirSync(join(DIST, 'assets')).filter((f) => f.endsWith('.js') && readFileSync(join(DIST, 'assets', f), 'utf-8').includes(MARKER))
  expect(chunks, 'exactly one chunk holds the tool').toHaveLength(1)
  const tool = `/assets/${chunks[0]}`
  const home = homeScripts()
  expect(home, 'home JS graph').not.toContain(tool)
  for (const src of home) expect(readFileSync(join(DIST, src), 'utf-8'), src).not.toContain(MARKER)
  const total = home.reduce((sum, src) => sum + gzipSize(join(DIST, src)), 0)
  expect(total, 'AC-PERF-001 budget still holds').toBeLessThanOrEqual(110 * KB)

  // in the browser: / never fetches the chunk, the tool page does
  const requested: string[] = []
  page.on('request', (r) => requested.push(new URL(r.url()).pathname))
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.mouse.move(200, 200)
  await page.waitForTimeout(300)
  expect(requested).not.toContain(tool)
  await page.goto('/narzedzia/sprawdz-zdjecie-produktu')
  await page.waitForLoadState('networkidle')
  expect(requested).toContain(tool)
})

test('[AC-PERF-004] icons and logos stay small on the landing page and in the app', () => {
  for (const dir of [resolve(HERE, '../public'), resolve(HERE, '../../frontend/public')]) {
    expect(statSync(join(dir, 'favicon.ico')).size, `${dir}/favicon.ico`).toBeLessThanOrEqual(16 * KB)
    expect(statSync(join(dir, 'logo.webp')).size, `${dir}/logo.webp`).toBeLessThanOrEqual(12 * KB)
    expect(existsSync(join(dir, 'logo.png')), `${dir}/logo.png (JSON-LD, apple-touch-icon)`).toBe(true)
  }
  expect(existsSync(resolve(HERE, '../public/og-image.png'))).toBe(true)
})

test('[AC-PERF-008] before/after photos and the navbar logo are served at their display size', async () => {
  const sharp = (await import('sharp')).default
  const html = readFileSync(join(DIST, 'index.html'), 'utf-8')
  const photos = [...html.matchAll(/<img[^>]+src="(\/samples\/[^"]+)"[^>]*>/g)]
  expect(photos.length, 'before/after photos on the home page').toBeGreaterThan(0)
  for (const [tag, src] of photos) {
    const srcset = tag.match(/srcset="([^"]+)"/i)?.[1]
    expect(srcset, `${src} srcset`).toBeDefined()
    expect(tag, `${src} sizes`).toMatch(/sizes="\(min-width: 1024px\) \d+px, \(min-width: 640px\) calc\(50vw - 36px\), calc\(100vw - 32px\)"/)
    const candidates = srcset!.split(',').map((c) => c.trim().split(' '))
    expect(candidates.map(([, w]) => w)).toEqual(['400w', '700w', '800w'])
    expect(candidates.at(-1)![0]).toBe(src)
    const original = statSync(join(DIST, src)).size
    for (const [url, w] of candidates) {
      const file = join(DIST, url)
      expect(existsSync(file), url).toBe(true)
      const meta = await sharp(file).metadata()
      expect(meta.format, url).toBe('webp')
      expect(`${meta.width}w`, url).toBe(w)
      if (url !== src) expect(statSync(file).size, `${url} is smaller than the original`).toBeLessThan(original)
    }
  }

  const logo = html.match(/<img[^>]+alt="AllGrafika.pl"[^>]*>/)?.[0]
  expect(logo).toContain('src="/logo-72.webp"')
  expect(logo).toMatch(/srcset="\/logo-72\.webp 2x, \/logo\.webp 4x"/i)
  expect(statSync(join(DIST, 'logo-72.webp')).size).toBeLessThanOrEqual(4 * KB)
  expect((await sharp(join(DIST, 'logo-72.webp')).metadata()).width).toBe(72)
})
