import { test, expect } from '@playwright/test'
import { spawn, spawnSync } from 'node:child_process'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  HOST,
  INDEXNOW_ENDPOINT,
  KEY_FILE_PATTERN,
  LANDING_ENVIRONMENT,
  MAX_RETRY_AFTER_MS,
  MAX_URLS_PER_REQUEST,
  SitemapError,
  STATUS_MESSAGES,
  buildPayload,
  chunk,
  describeStatus,
  diffSitemaps,
  findKey,
  findPreviousDeployment,
  parseArgs,
  parseSitemap,
  recentUrls,
  retryAfterMs,
  siteUrl,
  submit,
  verifyKey,
} from '../scripts/indexnow.js'

/**
 * Spec 26 – IndexNow notifications after landing production deploys. Pure Node: the IndexNow endpoint, the key file
 * check and the GitHub API are local fake servers, the git history is a throw-away repository (no real network).
 * Device-independent, so everything runs once (desktop-chrome project).
 */
const landing = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const repoRoot = resolve(landing, '..')
const script = resolve(landing, 'scripts/indexnow.js')
const publicDir = resolve(landing, 'public')
const tmpRoot = resolve(landing, 'test-results/indexnow')
const KEY = readdirSync(publicDir)
  .find((f) => KEY_FILE_PATTERN.test(f))
  ?.replace(/\.txt$/, '') as string

test.beforeEach(() => {
  test.skip(test.info().project.name !== 'desktop-chrome', 'device-independent – runs once')
})

// ── Helpers ───────────────────────────────────────────────────────────────────

type Entry = { loc: string; lastmod?: string }
function sitemap(entries: Entry[]): string {
  const urls = entries.map((e) => `  <url>\n    <loc>${e.loc}</loc>\n${e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>\n` : ''}    <priority>0.7</priority>\n  </url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}
const map = (entries: Entry[]) => parseSitemap(sitemap(entries))
const S = (path: string) => `https://${HOST}${path}`

type Recorded = { method: string; url: string; headers: IncomingMessage['headers']; body: string }
type Handler = (req: Recorded, res: ServerResponse) => void
async function fakeServer(handler: Handler) {
  const requests: Recorded[] = []
  const server = createServer((req, res) => {
    let body = ''
    req.setEncoding('utf-8')
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const rec = { method: req.method ?? '', url: req.url ?? '', headers: req.headers, body }
      requests.push(rec)
      handler(rec, res)
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return { base, requests, close: () => new Promise<void>((r) => server.close(() => r())) }
}
const reply = (res: ServerResponse, status: number, body = '', headers: Record<string, string> = {}) => {
  res.writeHead(status, { 'Content-Type': 'text/plain', ...headers })
  res.end(body)
}

/** A fake that plays IndexNow (POST /indexnow → statuses in order, last repeats) and the key file (GET /key.txt). */
async function fakeIndexNow(statuses: number[] = [200], keyBody: string = KEY, keyStatus = 200) {
  let i = 0
  return fakeServer((req, res) => {
    if (req.method === 'GET' && req.url === '/key.txt') return reply(res, keyStatus, keyBody)
    if (req.method === 'POST' && req.url === '/indexnow') return reply(res, statuses[Math.min(i++, statuses.length - 1)])
    reply(res, 404)
  })
}
const posts = (requests: Recorded[]) => requests.filter((r) => r.method === 'POST')

let seq = 0
function tmpDir(name: string): string {
  const dir = resolve(tmpRoot, `${process.pid}-${seq++}-${name}`)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  return dir
}
function tmpFile(name: string, content: string): string {
  const file = resolve(tmpDir('f'), name)
  writeFileSync(file, content, 'utf-8')
  return file
}

/** A throw-away repository whose commits contain landing-page/public/sitemap.xml – returns the shas in order. */
function gitRepo(versions: string[]): { dir: string; shas: string[] } {
  const dir = tmpDir('repo')
  const g = (...args: string[]) => {
    const r = spawnSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd: dir, encoding: 'utf-8' })
    expect(r.status, r.stderr).toBe(0)
    return r.stdout.trim()
  }
  g('init', '-q')
  mkdirSync(resolve(dir, 'landing-page/public'), { recursive: true })
  const shas = versions.map((xml, n) => {
    writeFileSync(resolve(dir, 'landing-page/public/sitemap.xml'), xml, 'utf-8')
    g('add', '-A')
    g('commit', '-q', '-m', `v${n}`)
    return g('rev-parse', 'HEAD')
  })
  return { dir, shas }
}

/** Runs the CLI asynchronously (the fake servers live in this process). */
function cli(args: string[], env: Record<string, string> = {}): Promise<{ code: number | null; out: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [script, ...args], {
      env: {
        PATH: process.env.PATH ?? '',
        SystemRoot: process.env.SystemRoot ?? '',
        // Never the real services: every test points these at a fake (or an unused port).
        INDEXNOW_ENDPOINT: 'http://127.0.0.1:9/indexnow',
        INDEXNOW_KEY_CHECK_URL: 'http://127.0.0.1:9/key.txt',
        GITHUB_API_URL: 'http://127.0.0.1:9',
        INDEXNOW_RETRY_BASE_MS: '1',
        ...env,
      },
    })
    let out = ''
    child.stdout.on('data', (c) => (out += c))
    child.stderr.on('data', (c) => (out += c))
    child.on('close', (code) => resolvePromise({ code, out }))
  })
}

const PREV = sitemap([
  { loc: S('/'), lastmod: '2026-10-10' },
  { loc: S('/blog'), lastmod: '2026-10-10' },
  { loc: S('/blog/stary-wpis'), lastmod: '2026-09-01' },
  { loc: S('/blog/usuniety-wpis'), lastmod: '2026-09-02' },
])
const CURR = sitemap([
  { loc: S('/'), lastmod: '2026-10-10' },
  { loc: S('/blog'), lastmod: '2026-10-17' },
  { loc: S('/blog/stary-wpis'), lastmod: '2026-09-01' },
  { loc: S('/blog/nowy-wpis'), lastmod: '2026-10-17' },
])

// ── AC-SEO-028: key file ──────────────────────────────────────────────────────

test.describe('[AC-SEO-028] IndexNow key file', () => {
  test('[AC-SEO-028] exactly one 32-hex key file whose content is only the key', () => {
    const files = readdirSync(publicDir).filter((f) => /^[0-9a-f]+\.txt$/i.test(f) || KEY_FILE_PATTERN.test(f))
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/^[0-9a-f]{32}\.txt$/)
    const raw = readFileSync(resolve(publicDir, files[0]))
    expect(raw.toString('utf-8')).toBe(files[0].replace(/\.txt$/, ''))
    expect(raw).toHaveLength(32) // no BOM, newline or whitespace
    expect(findKey(publicDir)).toEqual({ key: KEY, file: `${KEY}.txt` })
  })

  test('[AC-SEO-028] findKey rejects a missing, duplicated or padded key file', () => {
    const none = tmpDir('nokey')
    expect(() => findKey(none)).toThrow(/found 0/)
    const two = tmpDir('twokeys')
    writeFileSync(resolve(two, `${'a'.repeat(32)}.txt`), 'a'.repeat(32))
    writeFileSync(resolve(two, `${'b'.repeat(32)}.txt`), 'b'.repeat(32))
    expect(() => findKey(two)).toThrow(/found 2/)
    const padded = tmpDir('paddedkey')
    writeFileSync(resolve(padded, `${'c'.repeat(32)}.txt`), `${'c'.repeat(32)}\n`)
    expect(() => findKey(padded)).toThrow(/only the key/)
    const other = tmpDir('otherkey')
    writeFileSync(resolve(other, `${'d'.repeat(32)}.txt`), 'e'.repeat(32))
    expect(() => findKey(other)).toThrow(/only the key/)
  })

  test('[AC-SEO-028] the build copies the key file and the preview server serves it as text/plain', async ({ request }) => {
    const built = resolve(landing, 'dist', `${KEY}.txt`)
    expect(existsSync(built)).toBe(true)
    expect(readFileSync(built, 'utf-8')).toBe(KEY)
    const res = await request.get(`/${KEY}.txt`, { maxRedirects: 0 })
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toMatch(/^text\/plain/)
    expect(await res.text()).toBe(KEY)
  })

  test('[AC-SEO-028] vercel.json has no redirect, rewrite or header that matches the key file', () => {
    const vercel = JSON.parse(readFileSync(resolve(landing, 'vercel.json'), 'utf-8')) as Record<string, unknown>
    const path = `/${KEY}.txt`
    // Approximation of Vercel's path-to-regexp sources: `:name` = one segment, `:name*` / `(.*)` = anything.
    const toRegex = (source: string) => {
      const pattern = source
        .split('/')
        .map((seg) => {
          if (seg.startsWith(':')) return /[*+]$/.test(seg) ? '.*' : '[^/]+'
          return seg
            .split('(.*)')
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*')
        })
        .join('/')
      return new RegExp(`^${pattern}$`)
    }
    expect(toRegex('/:path*').test(path)).toBe(true) // the matcher itself catches catch-alls
    expect(toRegex('/(.*)').test(path)).toBe(true)
    expect(toRegex('/:slug').test(path)).toBe(true)
    expect(toRegex('/blog/:slug').test(path)).toBe(false)
    expect(toRegex('/zdjecia-ai-allegro').test(path)).toBe(false)
    for (const section of ['redirects', 'rewrites', 'headers', 'routes']) {
      const rules = (vercel[section] ?? []) as { source?: string; src?: string }[]
      for (const rule of rules) {
        const source = rule.source ?? rule.src ?? ''
        expect(toRegex(source).test(path), `${section}: ${source} must not match ${path}`).toBe(false)
        expect(source.includes(KEY), `${section} rule mentions the key file`).toBe(false)
      }
    }
    // No SPA catch-all that could swallow static files.
    expect(vercel.rewrites ?? []).toEqual([])
    expect(vercel.cleanUrls ?? false).toBe(false)
  })

  test('[AC-SEO-028] the sitemap and the prerendered routes do not contain the key file', () => {
    for (const file of [resolve(publicDir, 'sitemap.xml'), resolve(landing, 'dist/sitemap.xml')]) {
      const xml = readFileSync(file, 'utf-8')
      expect(xml).not.toContain(KEY)
      for (const loc of parseSitemap(xml).keys()) expect(loc).not.toMatch(/\.txt$/)
    }
    expect(existsSync(resolve(landing, 'dist', KEY))).toBe(false) // not a prerendered route directory
    const robots = readFileSync(resolve(publicDir, 'robots.txt'), 'utf-8')
    for (const line of robots.split('\n').filter((l) => /^Disallow:/i.test(l))) {
      const rule = line.replace(/^Disallow:\s*/i, '').trim()
      if (rule) expect(`/${KEY}.txt`.startsWith(rule)).toBe(false)
    }
  })

  test('[AC-SEO-028] the payload keyLocation is the published key file on the site host', () => {
    expect(buildPayload([S('/')], KEY).keyLocation).toBe(`https://allgrafika.pl/${KEY}.txt`)
  })
})

// ── AC-SEO-029: diff ─────────────────────────────────────────────────────────

test.describe('[AC-SEO-029] URLs to submit from the sitemap diff', () => {
  test('[AC-SEO-029] added, lastmod changed and removed URLs are submitted; unchanged ones are not', () => {
    const urls = diffSitemaps(parseSitemap(PREV), parseSitemap(CURR))
    expect(urls).toEqual([
      { url: S('/blog'), reason: 'changed', lastmod: '2026-10-17' },
      { url: S('/blog/nowy-wpis'), reason: 'added', lastmod: '2026-10-17' },
      { url: S('/blog/usuniety-wpis'), reason: 'removed', lastmod: null },
    ])
  })

  test('[AC-SEO-029] identical sitemaps give nothing to submit', () => {
    expect(diffSitemaps(parseSitemap(CURR), parseSitemap(CURR))).toEqual([])
  })

  test('[AC-SEO-029] a lastmod that appears or disappears counts as a change', () => {
    const urls = diffSitemaps(map([{ loc: S('/a') }, { loc: S('/b'), lastmod: '2026-01-01' }]), map([{ loc: S('/a'), lastmod: '2026-10-01' }, { loc: S('/b') }]))
    expect(urls.map((u: { reason: string }) => u.reason)).toEqual(['changed', 'changed'])
  })

  test('[AC-SEO-029] URLs of other hosts, www, http, ports and credentials are ignored', () => {
    const foreign = [
      'https://example.com/',
      'https://www.allgrafika.pl/blog',
      'http://allgrafika.pl/blog/x',
      'https://allgrafika.pl:8443/x',
      'https://user:pass@allgrafika.pl/x',
      'https://app.allgrafika.pl/',
      'https://allgrafika.pl.evil.example/',
      'not a url',
    ]
    const urls = diffSitemaps(map([]), map([...foreign.map((loc) => ({ loc, lastmod: '2026-10-19' })), { loc: S('/ok'), lastmod: '2026-10-19' }]))
    expect(urls.map((u: { url: string }) => u.url)).toEqual([S('/ok')])
    expect(diffSitemaps(map(foreign.map((loc) => ({ loc }))), map([]))).toEqual([])
    for (const f of foreign) expect(siteUrl(f)).toBeNull()
    expect(siteUrl('https://ALLGRAFIKA.pl/blog#top')).toBe(S('/blog'))
  })

  test('[AC-SEO-029] duplicates are submitted once (same URL twice, host case, fragment)', () => {
    const curr = map([
      { loc: S('/x'), lastmod: '2026-10-01' },
      { loc: S('/x'), lastmod: '2026-10-05' },
      { loc: 'https://AllGrafika.pl/x#frag', lastmod: '2026-10-03' },
      { loc: S('/y'), lastmod: '2026-10-05' },
    ])
    expect(curr.get(S('/x'))).toBe('2026-10-05') // newest lastmod wins
    const urls = diffSitemaps(map([]), curr)
    expect(urls.map((u: { url: string }) => u.url)).toEqual([S('/x'), S('/y')])
    expect(new Set(urls.map((u: { url: string }) => u.url)).size).toBe(urls.length)
    // Same URL, same newest lastmod → unchanged
    expect(
      diffSitemaps(
        map([
          { loc: S('/x'), lastmod: '2026-10-05' },
          { loc: S('/y'), lastmod: '2026-10-05' },
        ]),
        curr,
      ),
    ).toEqual([])
  })

  test('[AC-SEO-029] XML entities in <loc> are decoded and whitespace is trimmed', () => {
    const xml = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>
      https://allgrafika.pl/szukaj?a=1&amp;b=2&#38;c=&#x33;</loc><lastmod> 2026-10-19 </lastmod></url><!-- <url><loc>https://allgrafika.pl/comment</loc></url> --></urlset>`
    const parsed = parseSitemap(xml)
    expect([...parsed.entries()]).toEqual([['https://allgrafika.pl/szukaj?a=1&b=2&c=3', '2026-10-19']])
  })

  test('[AC-SEO-029] the committed sitemap parses and every URL is on the site host', () => {
    const parsed = parseSitemap(readFileSync(resolve(publicDir, 'sitemap.xml'), 'utf-8'))
    expect(parsed.size).toBeGreaterThan(10)
    for (const [loc, lastmod] of parsed) {
      expect(siteUrl(loc)).toBe(loc)
      expect(lastmod).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  test('[AC-SEO-029] CLI with two sitemap files lists the reasons and submits the diff', async () => {
    const fake = await fakeIndexNow([200])
    try {
      const r = await cli(['--current-file', tmpFile('c.xml', CURR), '--previous-file', tmpFile('p.xml', PREV)], {
        INDEXNOW_ENDPOINT: `${fake.base}/indexnow`,
        INDEXNOW_KEY_CHECK_URL: `${fake.base}/key.txt`,
      })
      expect(r.code, r.out).toBe(0)
      expect(r.out).toMatch(/changed\s+https:\/\/allgrafika\.pl\/blog \(lastmod 2026-10-17\)/)
      expect(r.out).toMatch(/added\s+https:\/\/allgrafika\.pl\/blog\/nowy-wpis/)
      expect(r.out).toMatch(/removed\s+https:\/\/allgrafika\.pl\/blog\/usuniety-wpis/)
      const [post] = posts(fake.requests)
      expect(JSON.parse(post.body).urlList).toEqual([S('/blog'), S('/blog/nowy-wpis'), S('/blog/usuniety-wpis')])
    } finally {
      await fake.close()
    }
  })
})

// ── AC-SEO-030: malformed sitemaps, fallbacks, nothing to send ─────────────────

test.describe('[AC-SEO-030] fallbacks and malformed sitemaps', () => {
  const malformed: [string, string, RegExp][] = [
    ['empty', '', /empty/],
    ['whitespace', '  \n ', /empty/],
    ['no urlset', '<?xml version="1.0"?><html><body>Not found</body></html>', /no <urlset>/],
    ['html 404 page', '<!doctype html><html><head><title>404</title></head></html>', /no <urlset>/],
    ['unclosed urlset', '<urlset><url><loc>https://allgrafika.pl/</loc></url>', /not closed/],
    ['unclosed url', '<urlset><url><loc>https://allgrafika.pl/</loc></urlset>', /unbalanced/],
    ['stray closing url', '<urlset></url></urlset>', /unbalanced/],
    ['url without loc', '<urlset><url><lastmod>2026-10-19</lastmod></url></urlset>', /0 <loc>/],
    ['url with two locs', '<urlset><url><loc>https://allgrafika.pl/a</loc><loc>https://allgrafika.pl/b</loc></url></urlset>', /2 <loc>/],
    ['empty loc', '<urlset><url><loc>  </loc></url></urlset>', /empty <loc>/],
    ['nested url', '<urlset><url><url><loc>https://allgrafika.pl/a</loc></url></url></urlset>', /nested|unbalanced|<loc>/],
  ]
  for (const [name, xml, message] of malformed) {
    test(`[AC-SEO-030] parseSitemap rejects: ${name}`, () => {
      expect(() => parseSitemap(xml)).toThrow(SitemapError)
      expect(() => parseSitemap(xml)).toThrow(message)
    })
  }

  test('[AC-SEO-030] an empty but valid <urlset> parses to nothing', () => {
    expect(parseSitemap('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>').size).toBe(0)
  })

  test('[AC-SEO-030] recentUrls keeps lastmod within the last 7 days (inclusive), skips missing/invalid dates', () => {
    const curr = map([
      { loc: S('/today'), lastmod: '2026-10-19' },
      { loc: S('/edge'), lastmod: '2026-10-12' },
      { loc: S('/old'), lastmod: '2026-10-11' },
      { loc: S('/datetime'), lastmod: '2026-10-15T08:00:00+00:00' },
      { loc: S('/future'), lastmod: '2026-10-25' },
      { loc: S('/none') },
      { loc: S('/garbage'), lastmod: 'yesterday' },
      { loc: 'https://example.com/recent', lastmod: '2026-10-19' },
    ])
    const urls = recentUrls(curr, { today: '2026-10-19' }).map((u: { url: string }) => u.url)
    expect(urls).toEqual([S('/today'), S('/edge'), S('/datetime'), S('/future')])
    expect(recentUrls(curr, { today: new Date('2026-10-19T23:59:00Z'), days: 0 }).map((u: { url: string }) => u.url)).toEqual([S('/today'), S('/future')])
    expect(recentUrls(curr, { today: '2026-10-19' })[0]).toEqual({ url: S('/today'), reason: 'recent', lastmod: '2026-10-19' })
  })

  test('[AC-SEO-030] malformed current sitemap → nothing sent, error logged, exit 0', async () => {
    const fake = await fakeIndexNow([200])
    try {
      const r = await cli(['--current-file', tmpFile('bad.xml', '<html>oops</html>'), '--previous-file', tmpFile('p.xml', PREV)], {
        INDEXNOW_ENDPOINT: `${fake.base}/indexnow`,
        INDEXNOW_KEY_CHECK_URL: `${fake.base}/key.txt`,
      })
      expect(r.code).toBe(0)
      expect(r.out).toContain('current sitemap')
      expect(r.out).toContain('nothing submitted')
      expect(r.out).toContain('no <urlset>')
      expect(fake.requests).toHaveLength(0)
    } finally {
      await fake.close()
    }
  })

  test('[AC-SEO-030] malformed previous sitemap → last-7-days fallback with a warning', async () => {
    const r = await cli(['--current-file', tmpFile('c.xml', CURR), '--previous-file', tmpFile('p.xml', '<urlset><url></urlset>'), '--today', '2026-10-19', '--dry-run', '--no-key-check'])
    expect(r.code).toBe(0)
    expect(r.out).toContain('the previous sitemap is malformed')
    expect(r.out).toContain('last 7 days')
    expect(r.out).toMatch(/recent\s+https:\/\/allgrafika\.pl\/blog \(lastmod 2026-10-17\)/)
    expect(r.out).toMatch(/recent\s+https:\/\/allgrafika\.pl\/blog\/nowy-wpis/)
    expect(r.out).not.toMatch(/stary-wpis/)
  })

  test('[AC-SEO-030] missing previous sitemap file → fallback', async () => {
    const r = await cli(['--current-file', tmpFile('c.xml', CURR), '--previous-file', resolve(tmpRoot, 'does-not-exist.xml'), '--today', '2026-10-19', '--dry-run', '--no-key-check'])
    expect(r.code).toBe(0)
    expect(r.out).toContain('previous sitemap file unreadable')
    expect(r.out).toContain('last 7 days')
  })

  test('[AC-SEO-030] git: unknown --since commit and a commit without the sitemap → fallback; changes are read from git', async () => {
    const { dir, shas } = gitRepo([PREV, CURR])
    const unknown = await cli(['--repo-root', dir, '--sha', shas[1], '--since', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef', '--today', '2026-10-19', '--dry-run', '--no-key-check'])
    expect(unknown.code).toBe(0)
    expect(unknown.out).toContain('cannot be read')
    expect(unknown.out).toContain('last 7 days')

    const diff = await cli(['--repo-root', dir, '--sha', shas[1], '--since', shas[0], '--dry-run', '--no-key-check'])
    expect(diff.code).toBe(0)
    expect(diff.out).toContain(`changes since commit ${shas[0]} (--since)`)
    expect(diff.out).toContain('3 URL(s) in 1 request(s)')

    const head = await cli(['--repo-root', dir, '--since', shas[0], '--dry-run', '--no-key-check']) // --sha defaults to HEAD
    expect(head.out).toContain('3 URL(s) in 1 request(s)')
  })

  test('[AC-SEO-030] current commit without a sitemap → nothing sent, exit 0', async () => {
    // Outside this repository – inside it git would find the worktree's own history.
    const outside = mkdtempSync(resolve(tmpdir(), 'indexnow-norepo-'))
    try {
      const r = await cli(['--repo-root', outside, '--sha', 'HEAD', '--since', 'HEAD~1'], { GIT_CEILING_DIRECTORIES: tmpdir() })
      expect(r.code).toBe(0)
      expect(r.out).toContain('cannot be read – nothing submitted')
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })

  test('[AC-SEO-030] no changes → exit 0 with "nothing to submit" and no request', async () => {
    const fake = await fakeIndexNow([200])
    try {
      const r = await cli(['--current-file', tmpFile('c.xml', CURR), '--previous-file', tmpFile('p.xml', CURR)], {
        INDEXNOW_ENDPOINT: `${fake.base}/indexnow`,
        INDEXNOW_KEY_CHECK_URL: `${fake.base}/key.txt`,
      })
      expect(r.code).toBe(0)
      expect(r.out).toContain('nothing to submit')
      expect(fake.requests).toHaveLength(0)
    } finally {
      await fake.close()
    }
  })

  test('[AC-SEO-030] no baseline at all and nothing recent → nothing to submit', async () => {
    const r = await cli(['--current-file', tmpFile('c.xml', CURR), '--today', '2027-01-01'])
    expect(r.code).toBe(0)
    expect(r.out).toContain('last 7 days – no baseline given')
    expect(r.out).toContain('nothing to submit')
  })
})

// ── AC-SEO-031: request shape and chunking ────────────────────────────────────

test.describe('[AC-SEO-031] request payload and chunking', () => {
  test('[AC-SEO-031] payload is exactly {host, key, keyLocation, urlList}', () => {
    const payload = buildPayload([S('/'), S('/blog')], KEY)
    expect(Object.keys(payload)).toEqual(['host', 'key', 'keyLocation', 'urlList'])
    expect(payload).toEqual({ host: 'allgrafika.pl', key: KEY, keyLocation: `https://allgrafika.pl/${KEY}.txt`, urlList: [S('/'), S('/blog')] })
    expect(INDEXNOW_ENDPOINT).toBe('https://api.indexnow.org/indexnow')
    expect(MAX_URLS_PER_REQUEST).toBe(10_000)
  })

  test('[AC-SEO-031] chunk splits into ≤ 10 000 URLs per request, preserving order', () => {
    const list = Array.from({ length: 25_001 }, (_, i) => S(`/p/${i}`))
    const parts = chunk(list)
    expect(parts.map((p: string[]) => p.length)).toEqual([10_000, 10_000, 5_001])
    expect(parts.flat()).toEqual(list)
    expect(chunk(list.slice(0, 10_000))).toHaveLength(1)
    expect(chunk([])).toEqual([])
    expect(chunk([1, 2, 3], 2)).toEqual([[1, 2], [3]])
    expect(() => chunk([1], 0)).toThrow(RangeError)
  })

  test('[AC-SEO-031] the real POST: method, path, content type and JSON body per the IndexNow docs', async () => {
    const fake = await fakeIndexNow([200])
    try {
      const r = await cli(['--current-file', tmpFile('c.xml', CURR), '--previous-file', tmpFile('p.xml', PREV)], {
        INDEXNOW_ENDPOINT: `${fake.base}/indexnow`,
        INDEXNOW_KEY_CHECK_URL: `${fake.base}/key.txt`,
      })
      expect(r.code, r.out).toBe(0)
      expect(fake.requests.map((q) => `${q.method} ${q.url}`)).toEqual(['GET /key.txt', 'POST /indexnow'])
      const post = posts(fake.requests)[0]
      expect(post.headers['content-type']).toBe('application/json; charset=utf-8')
      const body = JSON.parse(post.body)
      expect(Object.keys(body)).toEqual(['host', 'key', 'keyLocation', 'urlList'])
      expect(body.host).toBe('allgrafika.pl')
      expect(body.key).toBe(KEY)
      expect(body.keyLocation).toBe(`https://allgrafika.pl/${KEY}.txt`)
      expect(body.urlList).toHaveLength(3)
      expect(r.out).toContain('done – 1/1 request(s) accepted')
    } finally {
      await fake.close()
    }
  })

  test('[AC-SEO-031] 10 001 new URLs are sent as two requests (10 000 + 1)', async () => {
    const fake = await fakeIndexNow([200])
    try {
      const big = sitemap(Array.from({ length: 10_001 }, (_, i) => ({ loc: S(`/blog/wpis-${i}`), lastmod: '2026-10-19' })))
      const r = await cli(['--current-file', tmpFile('big.xml', big), '--previous-file', tmpFile('empty.xml', sitemap([]))], {
        INDEXNOW_ENDPOINT: `${fake.base}/indexnow`,
        INDEXNOW_KEY_CHECK_URL: `${fake.base}/key.txt`,
      })
      expect(r.code, r.out.slice(-500)).toBe(0)
      const sent = posts(fake.requests).map((p) => JSON.parse(p.body).urlList as string[])
      expect(sent.map((l) => l.length)).toEqual([10_000, 1])
      expect(sent.flat()).toHaveLength(10_001)
      expect(new Set(sent.flat()).size).toBe(10_001)
      expect(sent[1]).toEqual([S('/blog/wpis-10000')])
      expect(r.out).toContain('10001 URL(s) in 2 request(s)')
      expect(r.out).toContain('done – 2/2 request(s) accepted')
    } finally {
      await fake.close()
    }
  })
})

// ── AC-SEO-032: responses, retries, exit code ────────────────────────────────

test.describe('[AC-SEO-032] response handling and retries', () => {
  const payload = () => buildPayload([S('/')], KEY)
  async function run(statuses: number[], opts: { headers?: Record<string, string>; maxAttempts?: number } = {}) {
    let i = 0
    const fake = await fakeServer((_req, res) => reply(res, statuses[Math.min(i++, statuses.length - 1)], 'detail from server', opts.headers ?? {}))
    const delays: number[] = []
    try {
      const result = await submit(payload(), { endpoint: `${fake.base}/indexnow`, sleep: async (ms: number) => void delays.push(ms), baseDelayMs: 100, maxAttempts: opts.maxAttempts })
      return { result, delays, calls: fake.requests.length }
    } finally {
      await fake.close()
    }
  }

  for (const status of [200, 202]) {
    test(`[AC-SEO-032] ${status} is a success on the first attempt`, async () => {
      const { result, delays, calls } = await run([status])
      expect(result).toEqual({ ok: true, status, message: STATUS_MESSAGES[status], attempts: 1 })
      expect(calls).toBe(1)
      expect(delays).toEqual([])
    })
  }

  for (const [status, text] of [
    [400, /Bad request/],
    [403, /key not valid/],
    [422, /do not belong to the host/],
  ] as const) {
    test(`[AC-SEO-032] ${status} is not retried and has a clear message`, async () => {
      const { result, delays, calls } = await run([status, 200])
      expect(result.ok).toBe(false)
      expect(result.status).toBe(status)
      expect(result.message).toMatch(text)
      expect(result.message).toContain('detail from server')
      expect(result.attempts).toBe(1)
      expect(calls).toBe(1)
      expect(delays).toEqual([])
    })
  }

  test('[AC-SEO-032] 429 then 200 → retried with backoff and succeeds', async () => {
    const { result, delays, calls } = await run([429, 200])
    expect(result).toMatchObject({ ok: true, status: 200, attempts: 2 })
    expect(calls).toBe(2)
    expect(delays).toEqual([100])
  })

  test('[AC-SEO-032] persistent 5xx → 3 attempts with exponential backoff, then failure', async () => {
    const { result, delays, calls } = await run([503])
    expect(result).toMatchObject({ ok: false, status: 503, attempts: 3 })
    expect(result.message).toContain('IndexNow server error (503)')
    expect(calls).toBe(3)
    expect(delays).toEqual([100, 200])
  })

  test('[AC-SEO-032] 500, 502 then 202 → success on the third attempt', async () => {
    const { result, delays } = await run([500, 502, 202])
    expect(result).toMatchObject({ ok: true, status: 202, attempts: 3 })
    expect(delays).toEqual([100, 200])
  })

  test('[AC-SEO-032] persistent 429 stops after 3 attempts', async () => {
    const { result, calls } = await run([429])
    expect(result).toMatchObject({ ok: false, status: 429, attempts: 3 })
    expect(result.message).toMatch(/Too Many Requests/)
    expect(calls).toBe(3)
  })

  test('[AC-SEO-032] Retry-After (seconds) is honoured and capped at 60 s', async () => {
    expect((await run([429, 200], { headers: { 'Retry-After': '7' } })).delays).toEqual([7_000])
    expect((await run([503, 200], { headers: { 'Retry-After': '3600' } })).delays).toEqual([MAX_RETRY_AFTER_MS])
  })

  test('[AC-SEO-032] retryAfterMs parses seconds and HTTP dates, ignores garbage', () => {
    const now = Date.parse('2026-10-19T10:00:00Z')
    expect(retryAfterMs('5', now)).toBe(5_000)
    expect(retryAfterMs('0', now)).toBe(0)
    expect(retryAfterMs('Mon, 19 Oct 2026 10:00:30 GMT', now)).toBe(30_000)
    expect(retryAfterMs('Mon, 19 Oct 2026 09:00:00 GMT', now)).toBe(0)
    expect(retryAfterMs('Tue, 20 Oct 2026 10:00:00 GMT', now)).toBe(MAX_RETRY_AFTER_MS)
    expect(retryAfterMs(null, now)).toBeNull()
    expect(retryAfterMs('', now)).toBeNull()
    expect(retryAfterMs('soon', now)).toBeNull()
  })

  test('[AC-SEO-032] unexpected status (e.g. 404) is a failure without retry', async () => {
    const { result, calls } = await run([404])
    expect(result).toMatchObject({ ok: false, status: 404, attempts: 1 })
    expect(result.message).toContain('unexpected response (404)')
    expect(calls).toBe(1)
    expect(describeStatus(301)).toBe('unexpected response (301)')
  })

  test('[AC-SEO-032] network errors are retried and reported, never thrown', async () => {
    const delays: number[] = []
    const result = await submit(payload(), { endpoint: 'http://127.0.0.1:9/indexnow', sleep: async (ms: number) => void delays.push(ms), baseDelayMs: 10 })
    expect(result).toMatchObject({ ok: false, status: null, attempts: 3 })
    expect(result.message).toMatch(/^network error/)
    expect(delays).toEqual([10, 20])
    let calls = 0
    const flaky = async () => {
      if (calls++ === 0) throw new TypeError('fetch failed')
      return new Response('', { status: 200 })
    }
    expect(await submit(payload(), { fetchImpl: flaky, sleep: async () => {}, baseDelayMs: 1 })).toMatchObject({ ok: true, attempts: 2 })
  })

  for (const status of [400, 403, 422, 429, 500]) {
    test(`[AC-SEO-032] CLI exits 0 on HTTP ${status} and reports a GitHub warning + step summary`, async () => {
      const fake = await fakeIndexNow([status])
      const summaryFile = tmpFile('summary.md', '')
      try {
        const r = await cli(['--current-file', tmpFile('c.xml', CURR), '--previous-file', tmpFile('p.xml', PREV)], {
          INDEXNOW_ENDPOINT: `${fake.base}/indexnow`,
          INDEXNOW_KEY_CHECK_URL: `${fake.base}/key.txt`,
          GITHUB_ACTIONS: 'true',
          GITHUB_STEP_SUMMARY: summaryFile,
        })
        expect(r.code).toBe(0)
        expect(r.out).toContain(`::warning title=IndexNow::request 1/1 (3 URL(s)): HTTP ${status}`)
        expect(r.out).toContain('done – 0/1 request(s) accepted')
        expect(posts(fake.requests)).toHaveLength(status === 429 || status >= 500 ? 3 : 1)
        const summary = readFileSync(summaryFile, 'utf-8')
        expect(summary).toContain('### IndexNow')
        expect(summary).toContain('0/1 request(s) accepted')
        expect(summary).toContain(`HTTP ${status}`)
      } finally {
        await fake.close()
      }
    })
  }

  test('[AC-SEO-032] CLI success writes the submitted URLs to the step summary', async () => {
    const fake = await fakeIndexNow([202])
    const summaryFile = tmpFile('summary.md', '')
    try {
      const r = await cli(['--current-file', tmpFile('c.xml', CURR), '--previous-file', tmpFile('p.xml', PREV)], {
        INDEXNOW_ENDPOINT: `${fake.base}/indexnow`,
        INDEXNOW_KEY_CHECK_URL: `${fake.base}/key.txt`,
        GITHUB_STEP_SUMMARY: summaryFile,
      })
      expect(r.code).toBe(0)
      expect(r.out).toContain('HTTP 202 Accepted')
      const summary = readFileSync(summaryFile, 'utf-8')
      expect(summary).toContain('1/1 request(s) accepted, 3 URL(s)')
      expect(summary).toContain(`- added: ${S('/blog/nowy-wpis')}`)
      expect(summary).toContain(`- removed: ${S('/blog/usuniety-wpis')}`)
    } finally {
      await fake.close()
    }
  })

  test('[AC-SEO-032] invalid arguments are the only non-zero exit (2)', async () => {
    for (const args of [['--bogus'], ['--sha'], ['--deployment-id', 'abc'], ['--recent-days', '-1'], ['--today', '19.10.2026'], ['--since', '--dry-run'], ['--sha', '-n'], ['--no-key-check']]) {
      const r = await cli(args)
      expect(r.code, args.join(' ')).toBe(2)
      expect(r.out).toContain('Usage:')
    }
    expect(parseArgs(['--since', '', '--deployment-id', ''])).toMatchObject({ sha: 'HEAD', dryRun: false })
    expect(parseArgs(['--since', '', '--deployment-id', '']).since).toBeUndefined()
    expect(parseArgs(['--sha', 'abc123', '--github-previous', '--deployment-id', '42', '--dry-run'])).toMatchObject({
      sha: 'abc123',
      githubPrevious: true,
      deploymentId: '42',
      dryRun: true,
      keyCheck: true,
      recentDays: 7,
    })
  })
})

// ── AC-SEO-033: key check before submitting ──────────────────────────────────

test.describe('[AC-SEO-033] key file check before submitting', () => {
  test('[AC-SEO-033] verifyKey accepts only 200 with the exact key (surrounding whitespace tolerated)', async () => {
    const cases: [number, string, boolean][] = [
      [200, KEY, true],
      [200, `${KEY}\n`, true],
      [200, 'other', false],
      [200, '<!doctype html><html>home page</html>', false],
      [404, KEY, false],
      [500, KEY, false],
    ]
    for (const [status, body, ok] of cases) {
      const fake = await fakeServer((_req, res) => reply(res, status, body))
      try {
        const result = await verifyKey(`${fake.base}/key.txt`, KEY)
        expect(result.ok, `${status} ${body.slice(0, 20)}`).toBe(ok)
        if (!ok) expect(result.reason).toMatch(status === 200 ? /does not contain the key/ : new RegExp(`HTTP ${status}`))
      } finally {
        await fake.close()
      }
    }
  })

  test('[AC-SEO-033] a redirect is not followed (the key must be at keyLocation)', async () => {
    const fake = await fakeServer((req, res) => (req.url === '/key.txt' ? reply(res, 301, '', { Location: '/elsewhere.txt' }) : reply(res, 200, KEY)))
    try {
      const result = await verifyKey(`${fake.base}/key.txt`, KEY)
      expect(result).toMatchObject({ ok: false })
      expect(result.reason).toContain('HTTP 301')
      expect(fake.requests.map((r) => r.url)).toEqual(['/key.txt'])
    } finally {
      await fake.close()
    }
  })

  test('[AC-SEO-033] unreachable key file → not ok, never throws', async () => {
    const result = await verifyKey('http://127.0.0.1:9/key.txt', KEY)
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('not reachable')
  })

  for (const [name, body, status] of [
    ['404', KEY, 404],
    ['wrong content', 'not-the-key', 200],
  ] as const) {
    test(`[AC-SEO-033] CLI skips the submission when the key file answers ${name}`, async () => {
      const fake = await fakeIndexNow([200], body, status)
      try {
        const r = await cli(['--current-file', tmpFile('c.xml', CURR), '--previous-file', tmpFile('p.xml', PREV)], {
          INDEXNOW_ENDPOINT: `${fake.base}/indexnow`,
          INDEXNOW_KEY_CHECK_URL: `${fake.base}/key.txt`,
          GITHUB_ACTIONS: 'true',
        })
        expect(r.code).toBe(0)
        expect(r.out).toContain('::warning title=IndexNow::key file check failed – submission skipped')
        expect(posts(fake.requests)).toHaveLength(0)
      } finally {
        await fake.close()
      }
    })
  }

  test('[AC-SEO-033] CLI skips the submission when the key file is unreachable', async () => {
    const fake = await fakeIndexNow([200])
    try {
      const r = await cli(['--current-file', tmpFile('c.xml', CURR), '--previous-file', tmpFile('p.xml', PREV)], {
        INDEXNOW_ENDPOINT: `${fake.base}/indexnow`,
        INDEXNOW_KEY_CHECK_URL: 'http://127.0.0.1:9/key.txt',
      })
      expect(r.code).toBe(0)
      expect(r.out).toContain('key file check failed')
      expect(fake.requests).toHaveLength(0)
    } finally {
      await fake.close()
    }
  })

  test('[AC-SEO-033] no usable key file in public/ → nothing submitted, exit 0', async () => {
    const r = await cli(['--current-file', tmpFile('c.xml', CURR), '--previous-file', tmpFile('p.xml', PREV), '--public-dir', tmpDir('emptypublic')])
    expect(r.code).toBe(0)
    expect(r.out).toContain('no usable key file')
  })
})

// ── AC-SEO-034: dry run ──────────────────────────────────────────────────────

test.describe('[AC-SEO-034] dry run', () => {
  test('[AC-SEO-034] prints baseline, reasons and the exact request bodies; sends nothing', async () => {
    const fake = await fakeIndexNow([200])
    try {
      const r = await cli(['--current-file', tmpFile('c.xml', CURR), '--previous-file', tmpFile('p.xml', PREV), '--dry-run'], {
        INDEXNOW_ENDPOINT: `${fake.base}/indexnow`,
        INDEXNOW_KEY_CHECK_URL: `${fake.base}/key.txt`,
      })
      expect(r.code).toBe(0)
      expect(r.out).toContain('baseline: changes since file')
      expect(r.out).toContain('3 URL(s) in 1 request(s)')
      expect(r.out).toMatch(/changed\s+https:\/\/allgrafika\.pl\/blog/)
      expect(r.out).toMatch(/added\s+https:\/\/allgrafika\.pl\/blog\/nowy-wpis/)
      expect(r.out).toMatch(/removed\s+https:\/\/allgrafika\.pl\/blog\/usuniety-wpis/)
      expect(r.out).toContain(`dry run – nothing is sent. Would POST 1 request(s) to ${fake.base}/indexnow`)
      const json = r.out.slice(r.out.indexOf('{'), r.out.lastIndexOf('}') + 1)
      expect(JSON.parse(json)).toEqual(buildPayload([S('/blog'), S('/blog/nowy-wpis'), S('/blog/usuniety-wpis')], KEY))
      expect(r.out).toContain('key file OK')
      expect(posts(fake.requests)).toHaveLength(0)
      expect(fake.requests.map((q) => q.url)).toEqual(['/key.txt'])
    } finally {
      await fake.close()
    }
  })

  test('[AC-SEO-034] reports an unreachable key file and that a real run would skip', async () => {
    const fake = await fakeIndexNow([200], 'nope', 404)
    try {
      const r = await cli(['--current-file', tmpFile('c.xml', CURR), '--previous-file', tmpFile('p.xml', PREV), '--dry-run'], {
        INDEXNOW_ENDPOINT: `${fake.base}/indexnow`,
        INDEXNOW_KEY_CHECK_URL: `${fake.base}/key.txt`,
      })
      expect(r.code).toBe(0)
      expect(r.out).toContain('key file NOT reachable')
      expect(r.out).toContain('a real run would skip the submission')
      expect(posts(fake.requests)).toHaveLength(0)
    } finally {
      await fake.close()
    }
  })

  test('[AC-SEO-034] --no-key-check makes no request at all; chunked dry run prints every body', async () => {
    const fake = await fakeIndexNow([200])
    try {
      const big = sitemap(Array.from({ length: 10_002 }, (_, i) => ({ loc: S(`/x/${i}`), lastmod: '2026-10-19' })))
      const r = await cli(['--current-file', tmpFile('big.xml', big), '--today', '2026-10-19', '--dry-run', '--no-key-check'], {
        INDEXNOW_ENDPOINT: `${fake.base}/indexnow`,
        INDEXNOW_KEY_CHECK_URL: `${fake.base}/key.txt`,
      })
      expect(r.code).toBe(0)
      expect(r.out).toContain('Would POST 2 request(s)')
      expect(r.out.match(/"keyLocation"/g)).toHaveLength(2)
      expect(r.out).toContain('key file check skipped')
      expect(fake.requests).toHaveLength(0)
    } finally {
      await fake.close()
    }
  })
})

// ── AC-SEO-035: previous deployment via the GitHub API ────────────────────────

test.describe('[AC-SEO-035] previous successful production deployment', () => {
  const ENV = LANDING_ENVIRONMENT
  type Dep = { id: number; sha: string; environment: string; states: string[] }
  async function fakeGitHub(deps: Dep[], { failDeployments = false } = {}) {
    return fakeServer((req, res) => {
      const url = new URL(req.url, 'http://x')
      const statuses = url.pathname.match(/^\/repos\/o\/r\/deployments\/(\d+)\/statuses$/)
      if (failDeployments) return reply(res, 500, 'boom')
      if (url.pathname === '/repos/o/r/deployments') {
        const env = url.searchParams.get('environment')
        const list = deps.filter((d) => !env || d.environment === env).sort((a, b) => b.id - a.id)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify(list.map(({ id, sha, environment }) => ({ id, sha, environment }))))
      }
      if (statuses) {
        const dep = deps.find((d) => d.id === Number(statuses[1]))
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify((dep?.states ?? []).map((state) => ({ state }))))
      }
      reply(res, 404)
    })
  }
  const deps: Dep[] = [
    { id: 10, sha: 'a'.repeat(40), environment: ENV, states: ['success'] },
    { id: 11, sha: 'b'.repeat(40), environment: 'Production – miniaturyallegro-ui', states: ['success'] },
    { id: 12, sha: 'c'.repeat(40), environment: ENV, states: ['inactive', 'success'] },
    { id: 13, sha: 'd'.repeat(40), environment: ENV, states: ['failure', 'pending'] },
    { id: 14, sha: 'e'.repeat(40), environment: 'Preview – miniaturyallegro-pl', states: ['success'] },
    { id: 15, sha: 'f'.repeat(40), environment: ENV, states: ['success'] },
    { id: 16, sha: 'f'.repeat(40), environment: ENV, states: ['success'] },
  ]

  test('[AC-SEO-035] picks the newest older successful deployment of the same environment', async () => {
    const gh = await fakeGitHub(deps)
    try {
      const find = (o: object) => findPreviousDeployment({ apiUrl: gh.base, repo: 'o/r', token: 't0ken', ...o })
      expect(await find({ beforeId: 16 })).toEqual({ id: 15, sha: 'f'.repeat(40) }) // redeploy of the same sha → empty diff later
      expect(await find({ beforeId: 15 })).toEqual({ id: 12, sha: 'c'.repeat(40) }) // skips failed 13, preview 14, ui 11
      expect(await find({ beforeId: 12 })).toEqual({ id: 10, sha: 'a'.repeat(40) })
      expect(await find({ beforeId: 10 })).toBeNull()
      // Manual run: newest successful deployment of another commit
      expect(await find({ excludeSha: 'f'.repeat(40) })).toEqual({ id: 12, sha: 'c'.repeat(40) })
      expect(await find({})).toEqual({ id: 16, sha: 'f'.repeat(40) })
      const listCall = gh.requests.find((r) => r.url.startsWith('/repos/o/r/deployments?'))!
      expect(listCall.url).toBe(`/repos/o/r/deployments?environment=${encodeURIComponent(ENV)}&per_page=100`)
      expect(listCall.headers.authorization).toBe('Bearer t0ken')
      expect(listCall.headers.accept).toBe('application/vnd.github+json')
      expect(gh.requests.every((r) => r.method === 'GET')).toBe(true)
    } finally {
      await gh.close()
    }
  })

  test('[AC-SEO-035] API errors throw (the CLI then falls back), a missing repo is an error', async () => {
    const gh = await fakeGitHub(deps, { failDeployments: true })
    try {
      await expect(findPreviousDeployment({ apiUrl: gh.base, repo: 'o/r' })).rejects.toThrow(/HTTP 500/)
      await expect(findPreviousDeployment({ apiUrl: gh.base, repo: '' })).rejects.toThrow(/GITHUB_REPOSITORY/)
    } finally {
      await gh.close()
    }
  })

  test('[AC-SEO-035] CLI: deployment_status run diffs against the previous deployment commit', async () => {
    const { dir, shas } = gitRepo([PREV, CURR])
    const gh = await fakeGitHub([
      { id: 100, sha: shas[0], environment: ENV, states: ['success'] },
      { id: 101, sha: shas[1], environment: ENV, states: ['success'] },
    ])
    try {
      const r = await cli(['--repo-root', dir, '--sha', shas[1], '--github-previous', '--deployment-id', '101', '--dry-run', '--no-key-check'], {
        GITHUB_API_URL: gh.base,
        GITHUB_REPOSITORY: 'o/r',
        GITHUB_TOKEN: 'x',
      })
      expect(r.code).toBe(0)
      expect(r.out).toContain(`previous successful production deployment 100 (commit ${shas[0].slice(0, 12)})`)
      expect(r.out).toContain('3 URL(s) in 1 request(s)')
    } finally {
      await gh.close()
    }
  })

  test('[AC-SEO-035] CLI: redeploy of the same commit → nothing to submit', async () => {
    const { dir, shas } = gitRepo([PREV, CURR])
    const gh = await fakeGitHub([
      { id: 100, sha: shas[1], environment: ENV, states: ['success'] },
      { id: 101, sha: shas[1], environment: ENV, states: ['success'] },
    ])
    try {
      const r = await cli(['--repo-root', dir, '--sha', shas[1], '--github-previous', '--deployment-id', '101'], { GITHUB_API_URL: gh.base, GITHUB_REPOSITORY: 'o/r' })
      expect(r.code).toBe(0)
      expect(r.out).toContain('nothing to submit')
    } finally {
      await gh.close()
    }
  })

  test('[AC-SEO-035] CLI: manual run without a deployment id uses the newest successful deployment of another commit', async () => {
    const { dir, shas } = gitRepo([PREV, CURR])
    const gh = await fakeGitHub([
      { id: 100, sha: shas[0], environment: ENV, states: ['success'] },
      { id: 101, sha: shas[1], environment: ENV, states: ['success'] },
    ])
    try {
      const r = await cli(['--repo-root', dir, '--github-previous', '--dry-run', '--no-key-check'], { GITHUB_API_URL: gh.base, GITHUB_REPOSITORY: 'o/r' })
      expect(r.code).toBe(0)
      expect(r.out).toContain('previous successful production deployment 100')
      expect(r.out).toContain('3 URL(s)')
    } finally {
      await gh.close()
    }
  })

  test('[AC-SEO-035] CLI: first deployment (none before) → last 7 days, without a warning', async () => {
    const { dir, shas } = gitRepo([CURR])
    const gh = await fakeGitHub([{ id: 100, sha: shas[0], environment: ENV, states: ['success'] }])
    try {
      const r = await cli(['--repo-root', dir, '--sha', shas[0], '--github-previous', '--deployment-id', '100', '--today', '2026-10-19', '--dry-run', '--no-key-check'], {
        GITHUB_API_URL: gh.base,
        GITHUB_REPOSITORY: 'o/r',
      })
      expect(r.code).toBe(0)
      expect(r.out).toContain('last 7 days – no previous successful production deployment')
      expect(r.out).not.toContain('WARNING')
      expect(r.out).toContain('2 URL(s) in 1 request(s)') // /blog and /blog/nowy-wpis (2026-10-17)
    } finally {
      await gh.close()
    }
  })

  test('[AC-SEO-035] CLI: API failure → last 7 days with a warning', async () => {
    const { dir, shas } = gitRepo([CURR])
    const gh = await fakeGitHub([], { failDeployments: true })
    try {
      const r = await cli(['--repo-root', dir, '--sha', shas[0], '--github-previous', '--deployment-id', '5', '--today', '2026-10-19', '--dry-run', '--no-key-check'], {
        GITHUB_API_URL: gh.base,
        GITHUB_REPOSITORY: 'o/r',
      })
      expect(r.code).toBe(0)
      expect(r.out).toContain('previous deployment lookup failed (GitHub API')
      expect(r.out).toContain('last 7 days')
    } finally {
      await gh.close()
    }
  })

  test('[AC-SEO-035] the environment name matches the Vercel GitHub deployments of the landing project', () => {
    expect(ENV).toBe('Production – miniaturyallegro-pl')
  })
})

// ── AC-SEO-036: workflow ─────────────────────────────────────────────────────

test.describe('[AC-SEO-036] .github/workflows/indexnow.yml', () => {
  let wf: any
  test.beforeAll(async () => {
    const yaml = await import('js-yaml')
    wf = yaml.load(readFileSync(resolve(repoRoot, '.github/workflows/indexnow.yml'), 'utf-8'))
  })

  test('[AC-SEO-036] triggers: deployment_status and workflow_dispatch with since + dry_run', () => {
    expect(Object.keys(wf.on).sort()).toEqual(['deployment_status', 'workflow_dispatch'])
    const inputs = wf.on.workflow_dispatch.inputs
    expect(Object.keys(inputs).sort()).toEqual(['dry_run', 'since'])
    expect(inputs.since).toMatchObject({ type: 'string', required: false })
    expect(inputs.dry_run).toMatchObject({ type: 'boolean', default: true })
  })

  test('[AC-SEO-036] read-only permissions: contents read and deployments read only', () => {
    expect(wf.permissions).toEqual({ contents: 'read', deployments: 'read' })
    for (const job of Object.values(wf.jobs) as { permissions?: unknown }[]) expect(job.permissions).toBeUndefined()
  })

  test('[AC-SEO-036] the job runs only for successful landing production deployments (or manually)', () => {
    const jobs = Object.values(wf.jobs) as { if: string }[]
    expect(jobs).toHaveLength(1)
    const condition = jobs[0].if.replace(/\s+/g, ' ')
    expect(condition).toContain("github.event_name == 'workflow_dispatch'")
    expect(condition).toContain("github.event.deployment_status.state == 'success'")
    expect(condition).toContain(`github.event.deployment.environment == '${LANDING_ENVIRONMENT}'`)
    expect(condition).not.toContain('miniaturyallegro-ui')
    // Evaluate the condition for representative events with a tiny interpreter of this expression's grammar.
    const evaluate = (ctx: Record<string, string>) =>
      condition.split(' || ').some((alt) =>
        alt
          .replace(/^\(|\)$/g, '')
          .split(' && ')
          .every((cmp) => {
            const [lhs, rhs] = cmp.split(' == ')
            return (ctx[lhs.trim()] ?? '') === rhs.trim().replace(/^'|'$/g, '')
          }),
      )
    const ev = (name: string, state: string, env: string) => ({ 'github.event_name': name, 'github.event.deployment_status.state': state, 'github.event.deployment.environment': env })
    expect(evaluate(ev('deployment_status', 'success', LANDING_ENVIRONMENT))).toBe(true)
    expect(evaluate(ev('deployment_status', 'pending', LANDING_ENVIRONMENT))).toBe(false)
    expect(evaluate(ev('deployment_status', 'failure', LANDING_ENVIRONMENT))).toBe(false)
    expect(evaluate(ev('deployment_status', 'success', 'Production – miniaturyallegro-ui'))).toBe(false)
    expect(evaluate(ev('deployment_status', 'success', 'Preview – miniaturyallegro-pl'))).toBe(false)
    expect(evaluate(ev('workflow_dispatch', '', ''))).toBe(true)
  })

  test('[AC-SEO-036] concurrency group without cancellation, timeout set', () => {
    const job = Object.values(wf.jobs)[0] as { concurrency: { group: string; 'cancel-in-progress': boolean }; 'timeout-minutes': number }
    expect(job.concurrency.group).toBe('indexnow-landing')
    expect(job.concurrency['cancel-in-progress']).toBe(false)
    expect(job['timeout-minutes']).toBeLessThanOrEqual(15)
  })

  test('[AC-SEO-036] checkout of the deployed commit with full history, Node 24, runs the script with the right arguments', () => {
    const job = Object.values(wf.jobs)[0] as { steps: { uses?: string; with?: Record<string, unknown>; run?: string; env?: Record<string, string> }[] }
    const checkout = job.steps.find((s) => s.uses?.startsWith('actions/checkout@'))!
    expect(checkout.with).toMatchObject({ ref: '${{ github.event.deployment.sha || github.sha }}', 'fetch-depth': 0, 'persist-credentials': false })
    const node = job.steps.find((s) => s.uses?.startsWith('actions/setup-node@'))!
    expect(node.with?.['node-version']).toBe(24)
    const run = job.steps.find((s) => s.run?.includes('landing-page/scripts/indexnow.js'))!
    expect(run.env).toMatchObject({
      GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
      DEPLOYMENT_SHA: '${{ github.event.deployment.sha || github.sha }}',
      DEPLOYMENT_ID: '${{ github.event.deployment.id }}',
      SINCE: '${{ inputs.since }}',
    })
    for (const flag of ['--sha "$DEPLOYMENT_SHA"', '--since "$SINCE"', '--github-previous', '--deployment-id "$DEPLOYMENT_ID"', '--dry-run']) expect(run.run).toContain(flag)
    // No npm install needed – the script uses Node built-ins only.
    expect(job.steps.some((s) => s.run?.includes('npm '))).toBe(false)
    expect(readFileSync(script, 'utf-8')).not.toMatch(/^import .* from '(?!node:)/m)
  })

  test('[AC-SEO-036] the workflow run step builds the expected argument lists (bash)', () => {
    const job = Object.values(wf.jobs)[0] as { steps: { run?: string }[] }
    const body = job.steps.find((s) => s.run?.includes('landing-page/scripts/indexnow.js'))!.run!.replace('node landing-page/scripts/indexnow.js "${args[@]}"', 'printf "%s|" "${args[@]}"')
    const bash = (env: Record<string, string>) => spawnSync('bash', ['-c', body], { env: { PATH: process.env.PATH ?? '', ...env }, encoding: 'utf-8' })
    const probe = bash({ DEPLOYMENT_SHA: 'abc', DEPLOYMENT_ID: '7', SINCE: '', DRY_RUN: '0' })
    test.skip(probe.error !== undefined || probe.status !== 0, 'bash not available')
    expect(probe.stdout).toBe('--sha|abc|--github-previous|--deployment-id|7|')
    expect(bash({ DEPLOYMENT_SHA: 'abc', DEPLOYMENT_ID: '', SINCE: 'def', DRY_RUN: '1' }).stdout).toBe('--sha|abc|--since|def|--dry-run|')
    expect(bash({ DEPLOYMENT_SHA: 'abc', DEPLOYMENT_ID: '', SINCE: '', DRY_RUN: '1' }).stdout).toBe('--sha|abc|--github-previous|--dry-run|')
  })
})
