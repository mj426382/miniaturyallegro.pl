#!/usr/bin/env node
/**
 * IndexNow notifications for allgrafika.pl (spec 26, AC-SEO-028..036) – https://www.indexnow.org/documentation
 *
 * Compares landing-page/public/sitemap.xml in the deployed commit with the sitemap of the previous successful
 * production deployment and submits the URLs that are new, whose <lastmod> changed, or that were removed from the
 * sitemap (they now answer 404/301 – search engines should see that too). Without a usable baseline it submits the
 * URLs whose <lastmod> is within the last 7 days (reason "recent"). The key is the only `<32 hex>.txt` file in public/ (public by
 * design – IndexNow verifies site ownership by fetching it).
 *
 * The deployment never depends on this script: every network / IndexNow failure is logged as a warning and the
 * process exits 0. Only invalid command-line arguments exit 2.
 *
 * Usage (from the repository root or anywhere – paths are resolved from this file):
 *   node landing-page/scripts/indexnow.js --sha <deployed sha> --github-previous --deployment-id <id>   (workflow)
 *   node landing-page/scripts/indexnow.js --sha HEAD --since <sha> --dry-run                            (manual)
 *
 * Options:
 *   --sha <ref>            commit whose sitemap is deployed (default HEAD)
 *   --since <ref>          baseline commit (skips the GitHub lookup)
 *   --github-previous      find the baseline: previous successful deployment of the landing production environment
 *   --deployment-id <id>   the current GitHub deployment (baseline = newest successful one with a lower id);
 *                          without it the baseline is the newest successful deployment of a different commit
 *   --recent-days <n>      fallback window (default 7)      --today <YYYY-MM-DD>  fallback reference date (default today, UTC)
 *   --dry-run              print what would be sent, send nothing to IndexNow
 *   --no-key-check         do not fetch keyLocation (dry run only)
 *   --current-file / --previous-file <path>   read sitemaps from files instead of git
 *   --repo-root <dir>      git repository (default: the repository containing this script)
 *   --public-dir <dir>     directory with the key file (default landing-page/public)
 *
 * Environment: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_API_URL (lookup); GITHUB_ACTIONS, GITHUB_STEP_SUMMARY (logging);
 * INDEXNOW_ENDPOINT, INDEXNOW_KEY_CHECK_URL, INDEXNOW_RETRY_BASE_MS, INDEXNOW_ENVIRONMENT (test overrides).
 */

import { execFileSync } from 'node:child_process'
import { appendFileSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const HOST = 'allgrafika.pl'
export const SITE_ORIGIN = `https://${HOST}`
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'
export const MAX_URLS_PER_REQUEST = 10_000
export const RECENT_DAYS = 7
export const MAX_ATTEMPTS = 3
export const RETRY_BASE_MS = 2_000
export const MAX_RETRY_AFTER_MS = 60_000
export const LANDING_ENVIRONMENT = 'Production – miniaturyallegro-pl'
export const SITEMAP_PATH = 'landing-page/public/sitemap.xml'
export const KEY_FILE_PATTERN = /^([0-9a-f]{32})\.txt$/

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_PUBLIC_DIR = resolve(__dirname, '../public')
const DEFAULT_REPO_ROOT = resolve(__dirname, '../..')

// ── Sitemap ───────────────────────────────────────────────────────────────────

export class SitemapError extends Error {}

const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodeXml(text) {
  return text.replace(/&(?:(amp|lt|gt|quot|apos)|#(\d+)|#x([0-9a-fA-F]+));/g, (_, name, dec, hex) => {
    if (name) return XML_ENTITIES[name]
    return String.fromCodePoint(dec ? Number(dec) : parseInt(hex, 16))
  })
}

/**
 * Parses a sitemap <urlset> into Map<loc, lastmod | null>. Throws SitemapError when the document is not a usable
 * sitemap (no <urlset>, unbalanced <url>, a <url> without exactly one <loc>). A URL listed twice keeps its newest lastmod.
 */
export function parseSitemap(xml) {
  if (typeof xml !== 'string' || !xml.trim()) throw new SitemapError('the sitemap is empty')
  const body = xml.replace(/<!--[\s\S]*?-->/g, '')
  const open = body.match(/<urlset\b[^>]*>/)
  if (!open) throw new SitemapError('no <urlset> element')
  const close = body.lastIndexOf('</urlset>')
  if (close < open.index) throw new SitemapError('<urlset> is not closed')
  const inner = body.slice(open.index + open[0].length, close)
  const opened = (inner.match(/<url[\s>]/g) ?? []).length
  const closed = (inner.match(/<\/url>/g) ?? []).length
  if (opened !== closed) throw new SitemapError(`unbalanced <url> elements (${opened} opened, ${closed} closed)`)

  const entries = new Map()
  let index = 0
  for (const match of inner.matchAll(/<url(?:\s[^>]*)?>([\s\S]*?)<\/url>/g)) {
    index++
    const block = match[1]
    if (/<url[\s>]/.test(block)) throw new SitemapError(`<url> #${index} contains a nested <url>`)
    const locs = [...block.matchAll(/<loc>([\s\S]*?)<\/loc>/g)]
    if (locs.length !== 1) throw new SitemapError(`<url> #${index} has ${locs.length} <loc> elements (expected 1)`)
    const loc = decodeXml(locs[0][1].trim())
    if (!loc) throw new SitemapError(`<url> #${index} has an empty <loc>`)
    const lastmod = block.match(/<lastmod>([\s\S]*?)<\/lastmod>/)?.[1].trim() || null
    const known = entries.get(loc)
    if (!entries.has(loc) || (lastmod && (!known || lastmod > known))) entries.set(loc, lastmod)
  }
  return entries
}

/** Canonical form of a URL of the site, or null for anything that is not https://allgrafika.pl/… */
export function siteUrl(loc, host = HOST) {
  let url
  try {
    url = new URL(loc)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.hostname !== host || url.port || url.username || url.password) return null
  url.hash = ''
  return url.href
}

/** Keeps only the site's URLs (normalised, deduplicated – the newest lastmod wins). */
export function siteEntries(entries, host = HOST) {
  const out = new Map()
  for (const [loc, lastmod] of entries) {
    const url = siteUrl(loc, host)
    if (!url) continue
    const known = out.get(url)
    if (!out.has(url) || (lastmod && (!known || lastmod > known))) out.set(url, lastmod)
  }
  return out
}

/** URLs added to, changed in (lastmod) or removed from the sitemap – each once, in sitemap order. */
export function diffSitemaps(previous, current, host = HOST) {
  const prev = siteEntries(previous, host)
  const curr = siteEntries(current, host)
  const urls = []
  for (const [url, lastmod] of curr) {
    if (!prev.has(url)) urls.push({ url, reason: 'added', lastmod })
    else if (prev.get(url) !== lastmod) urls.push({ url, reason: 'changed', lastmod })
  }
  for (const url of prev.keys()) if (!curr.has(url)) urls.push({ url, reason: 'removed', lastmod: null })
  return urls
}

/** Fallback without a baseline: URLs whose lastmod (date part) is on or after `today − days`. */
export function recentUrls(current, { today = new Date(), days = RECENT_DAYS, host = HOST } = {}) {
  const ref = typeof today === 'string' ? new Date(`${today}T00:00:00Z`) : today
  const cutoff = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() - days)).toISOString().slice(0, 10)
  const urls = []
  for (const [url, lastmod] of siteEntries(current, host)) {
    if (lastmod && /^\d{4}-\d{2}-\d{2}/.test(lastmod) && lastmod.slice(0, 10) >= cutoff) urls.push({ url, reason: 'recent', lastmod })
  }
  return urls
}

// ── Request ───────────────────────────────────────────────────────────────────

export function chunk(list, size = MAX_URLS_PER_REQUEST) {
  if (!Number.isInteger(size) || size < 1) throw new RangeError('chunk size must be a positive integer')
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

export function keyLocation(key) {
  return `${SITE_ORIGIN}/${key}.txt`
}

/** The JSON body defined by the IndexNow protocol for a POST with several URLs. */
export function buildPayload(urlList, key) {
  return { host: HOST, key, keyLocation: keyLocation(key), urlList }
}

/** The single `<32 hex>.txt` key file in public/ whose content is exactly the key. */
export function findKey(publicDir = DEFAULT_PUBLIC_DIR) {
  const files = readdirSync(publicDir).filter((f) => KEY_FILE_PATTERN.test(f))
  if (files.length !== 1) throw new Error(`expected exactly one IndexNow key file (<32 hex>.txt) in ${publicDir}, found ${files.length}`)
  const key = files[0].match(KEY_FILE_PATTERN)[1]
  const content = readFileSync(resolve(publicDir, files[0]), 'utf-8')
  if (content !== key) throw new Error(`${files[0]} must contain only the key (no whitespace or newline)`)
  return { key, file: files[0] }
}

export const STATUS_MESSAGES = {
  200: 'OK – URLs submitted successfully',
  202: 'Accepted – URLs received, key validation pending',
  400: 'Bad request – invalid format of the submission',
  403: 'Forbidden – key not valid (key file missing at keyLocation or its content differs from the key)',
  422: 'Unprocessable Entity – URLs do not belong to the host or the key does not match the protocol',
  429: 'Too Many Requests – rate limited (possible spam)',
}

export function describeStatus(status) {
  if (STATUS_MESSAGES[status]) return STATUS_MESSAGES[status]
  if (status >= 500) return `IndexNow server error (${status})`
  return `unexpected response (${status})`
}

const isRetryable = (status) => status === 429 || status >= 500

/** Retry-After as delay in ms (seconds or HTTP date), capped; null when absent or unparsable. */
export function retryAfterMs(header, now = Date.now(), cap = MAX_RETRY_AFTER_MS) {
  if (header == null || header === '') return null
  const text = String(header).trim()
  let ms
  if (/^\d+$/.test(text)) ms = Number(text) * 1000
  else {
    const date = Date.parse(text)
    if (Number.isNaN(date)) return null
    ms = date - now
  }
  return Math.min(Math.max(ms, 0), cap)
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * POSTs one payload. 200/202 → ok. 400/403/422 → not retried. 429/5xx/network → retried up to maxAttempts with
 * exponential backoff (baseDelayMs · 2^(attempt−1)) or Retry-After. Never throws.
 */
export async function submit(payload, { endpoint = INDEXNOW_ENDPOINT, fetchImpl = fetch, sleep = defaultSleep, maxAttempts = MAX_ATTEMPTS, baseDelayMs = RETRY_BASE_MS, log = () => {} } = {}) {
  let last = { ok: false, status: null, message: 'not sent', attempts: 0 }
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res
    try {
      res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      })
    } catch (err) {
      last = { ok: false, status: null, message: `network error: ${err?.cause?.code ?? err?.message ?? err}`, attempts: attempt }
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * 2 ** (attempt - 1)
        log(`attempt ${attempt}/${maxAttempts} failed (${last.message}) – retrying in ${delay} ms`)
        await sleep(delay)
        continue
      }
      return last
    }
    const status = res.status
    if (status === 200 || status === 202) {
      await res.text().catch(() => '')
      return { ok: true, status, message: describeStatus(status), attempts: attempt }
    }
    const detail = (await res.text().catch(() => '')).replace(/\s+/g, ' ').trim().slice(0, 300)
    last = { ok: false, status, message: describeStatus(status) + (detail ? ` – ${detail}` : ''), attempts: attempt }
    if (isRetryable(status) && attempt < maxAttempts) {
      const delay = retryAfterMs(res.headers.get('retry-after')) ?? baseDelayMs * 2 ** (attempt - 1)
      log(`attempt ${attempt}/${maxAttempts}: HTTP ${status} – retrying in ${delay} ms`)
      await sleep(delay)
      continue
    }
    return last
  }
  return last
}

/** GET keyLocation must answer 200 with exactly the key (redirects are not followed – IndexNow expects the file there). */
export async function verifyKey(url, key, { fetchImpl = fetch } = {}) {
  try {
    const res = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
    const body = await res.text().catch(() => '')
    if (res.status !== 200) return { ok: false, reason: `${url} answered HTTP ${res.status}` }
    if (body.trim() !== key) return { ok: false, reason: `${url} does not contain the key` }
    return { ok: true, reason: `${url} serves the key` }
  } catch (err) {
    return { ok: false, reason: `${url} is not reachable (${err?.cause?.code ?? err?.message ?? err})` }
  }
}

// ── Baseline: previous successful production deployment ─────────────────────

/**
 * Newest deployment of `environment` that has a `success` status, older than `beforeId` (when given) and of a
 * different commit than `excludeSha` (when given). Returns { id, sha } or null; throws on API errors.
 */
export async function findPreviousDeployment({
  apiUrl = 'https://api.github.com',
  repo,
  token,
  environment = LANDING_ENVIRONMENT,
  beforeId = null,
  excludeSha = null,
  fetchImpl = fetch,
  maxChecks = 30,
}) {
  if (!repo) throw new Error('GITHUB_REPOSITORY is not set')
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  const get = async (path) => {
    const res = await fetchImpl(`${apiUrl.replace(/\/+$/, '')}${path}`, { headers, signal: AbortSignal.timeout(20_000) })
    if (!res.ok) throw new Error(`GitHub API ${path} answered HTTP ${res.status}`)
    return res.json()
  }
  const deployments = await get(`/repos/${repo}/deployments?environment=${encodeURIComponent(environment)}&per_page=100`)
  if (!Array.isArray(deployments)) throw new Error('GitHub API returned an unexpected deployments payload')
  const candidates = deployments
    .filter((d) => d.environment === environment)
    .filter((d) => beforeId == null || Number(d.id) < Number(beforeId))
    .filter((d) => !excludeSha || d.sha !== excludeSha)
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, maxChecks)
  for (const d of candidates) {
    const statuses = await get(`/repos/${repo}/deployments/${d.id}/statuses?per_page=100`)
    if (Array.isArray(statuses) && statuses.some((s) => s.state === 'success')) return { id: d.id, sha: d.sha }
  }
  return null
}

// ── Git ───────────────────────────────────────────────────────────────────────

const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/~^-]*$/

function git(repoRoot, args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
}

export function sitemapAt(repoRoot, ref) {
  if (!REF_PATTERN.test(ref)) throw new Error(`invalid git ref: ${ref}`)
  return git(repoRoot, ['show', `${ref}:${SITEMAP_PATH}`])
}

function resolveSha(repoRoot, ref) {
  if (!REF_PATTERN.test(ref)) throw new Error(`invalid git ref: ${ref}`)
  return git(repoRoot, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).trim()
}

// ── CLI ───────────────────────────────────────────────────────────────────────

export class UsageError extends Error {}

const VALUE_OPTIONS = new Set(['--sha', '--since', '--deployment-id', '--recent-days', '--today', '--current-file', '--previous-file', '--repo-root', '--public-dir'])
const FLAG_OPTIONS = new Set(['--dry-run', '--no-key-check', '--github-previous'])

export function parseArgs(argv) {
  const opts = { sha: 'HEAD', recentDays: RECENT_DAYS, dryRun: false, keyCheck: true, githubPrevious: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (FLAG_OPTIONS.has(arg)) {
      if (arg === '--dry-run') opts.dryRun = true
      if (arg === '--no-key-check') opts.keyCheck = false
      if (arg === '--github-previous') opts.githubPrevious = true
      continue
    }
    if (!VALUE_OPTIONS.has(arg)) throw new UsageError(`unknown option: ${arg}`)
    const value = argv[++i]
    if (value === undefined || value.startsWith('--')) throw new UsageError(`${arg} needs a value`)
    const name = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())
    opts[name] = value
  }
  // Empty strings come from optional workflow inputs – treat them as "not given".
  for (const k of ['since', 'deploymentId', 'today']) if (opts[k] === '') delete opts[k]
  opts.recentDays = Number(opts.recentDays)
  if (!Number.isInteger(opts.recentDays) || opts.recentDays < 0) throw new UsageError('--recent-days must be a non-negative integer')
  if (opts.today && !/^\d{4}-\d{2}-\d{2}$/.test(opts.today)) throw new UsageError('--today must be YYYY-MM-DD')
  if (opts.deploymentId && !/^\d+$/.test(opts.deploymentId)) throw new UsageError('--deployment-id must be a number')
  for (const k of ['sha', 'since']) if (opts[k] && !REF_PATTERN.test(opts[k])) throw new UsageError(`--${k} is not a valid git ref`)
  if (!opts.keyCheck && !opts.dryRun) throw new UsageError('--no-key-check is only allowed with --dry-run')
  return opts
}

/** Runs the whole flow; returns the exit code (0 except for usage errors). */
export async function main(argv = process.argv.slice(2), env = process.env) {
  const inActions = env.GITHUB_ACTIONS === 'true'
  const info = (msg) => console.log(`IndexNow: ${msg}`)
  const warn = (msg) => console.log(inActions ? `::warning title=IndexNow::${msg}` : `IndexNow WARNING: ${msg}`)
  const summary = (lines) => {
    if (!env.GITHUB_STEP_SUMMARY) return
    try {
      appendFileSync(env.GITHUB_STEP_SUMMARY, ['### IndexNow', '', ...lines, ''].join('\n') + '\n')
    } catch {
      /* the summary is best effort */
    }
  }

  let opts
  try {
    opts = parseArgs(argv)
  } catch (err) {
    console.error(`IndexNow: ${err.message}\nUsage: node landing-page/scripts/indexnow.js [--sha <ref>] [--since <ref> | --github-previous [--deployment-id <id>]] [--dry-run]`)
    return 2
  }
  const repoRoot = opts.repoRoot ? resolve(opts.repoRoot) : DEFAULT_REPO_ROOT

  let key
  try {
    key = findKey(opts.publicDir ? resolve(opts.publicDir) : DEFAULT_PUBLIC_DIR).key
  } catch (err) {
    warn(`no usable key file – nothing submitted (${err.message})`)
    summary([`⚠️ No usable key file: ${err.message}`])
    return 0
  }

  // Current sitemap
  let current
  try {
    current = parseSitemap(opts.currentFile ? readFileSync(resolve(opts.currentFile), 'utf-8') : sitemapAt(repoRoot, opts.sha))
  } catch (err) {
    warn(`the current sitemap (${opts.currentFile ?? `${opts.sha}:${SITEMAP_PATH}`}) cannot be read – nothing submitted (${err.message})`)
    summary([`⚠️ Current sitemap unreadable: ${err.message}`])
    return 0
  }

  // Baseline
  let baseline = null // { label, xml }
  let fallbackReason = 'no baseline given'
  if (opts.previousFile) {
    try {
      baseline = { label: `file ${opts.previousFile}`, xml: readFileSync(resolve(opts.previousFile), 'utf-8') }
    } catch (err) {
      fallbackReason = `previous sitemap file unreadable (${err.message})`
    }
  } else {
    let since = opts.since ?? null
    let sinceLabel = since ? `commit ${since} (--since)` : null
    if (!since && opts.githubPrevious) {
      try {
        let excludeSha = null
        if (!opts.deploymentId) excludeSha = opts.currentFile ? opts.sha : resolveSha(repoRoot, opts.sha)
        const prev = await findPreviousDeployment({
          apiUrl: env.GITHUB_API_URL || 'https://api.github.com',
          repo: env.GITHUB_REPOSITORY,
          token: env.GITHUB_TOKEN,
          environment: env.INDEXNOW_ENVIRONMENT || LANDING_ENVIRONMENT,
          beforeId: opts.deploymentId ?? null,
          excludeSha,
        })
        if (prev) {
          since = prev.sha
          sinceLabel = `previous successful production deployment ${prev.id} (commit ${prev.sha.slice(0, 12)})`
        } else fallbackReason = 'no previous successful production deployment'
      } catch (err) {
        fallbackReason = `previous deployment lookup failed (${err.message})`
      }
    }
    if (since) {
      try {
        baseline = { label: sinceLabel, xml: sitemapAt(repoRoot, since) }
      } catch (err) {
        fallbackReason = `the sitemap at ${since} cannot be read (${
          String(err.stderr || err.message)
            .trim()
            .split('\n')[0]
        })`
      }
    }
  }

  let selection
  let mode
  if (baseline) {
    try {
      selection = diffSitemaps(parseSitemap(baseline.xml), current)
      mode = `changes since ${baseline.label}`
    } catch (err) {
      fallbackReason = `the previous sitemap is malformed (${err.message})`
      baseline = null
    }
  }
  if (!baseline) {
    selection = recentUrls(current, { today: opts.today ?? new Date(), days: opts.recentDays })
    mode = `URLs with lastmod in the last ${opts.recentDays} days – ${fallbackReason}`
    if (fallbackReason !== 'no baseline given' && fallbackReason !== 'no previous successful production deployment') warn(fallbackReason)
  }
  info(`baseline: ${mode}`)

  if (selection.length === 0) {
    info('nothing to submit – no sitemap URL was added, changed or removed')
    summary([`Baseline: ${mode}`, '', 'Nothing to submit.'])
    return 0
  }

  const payloads = chunk(selection.map((s) => s.url)).map((urls) => buildPayload(urls, key))
  info(`${selection.length} URL(s) in ${payloads.length} request(s):`)
  for (const s of selection) console.log(`  ${s.reason.padEnd(8)} ${s.url}${s.lastmod ? ` (lastmod ${s.lastmod})` : ''}`)

  const keyUrl = env.INDEXNOW_KEY_CHECK_URL || keyLocation(key)
  const endpoint = env.INDEXNOW_ENDPOINT || INDEXNOW_ENDPOINT

  if (opts.dryRun) {
    info(`dry run – nothing is sent. Would POST ${payloads.length} request(s) to ${endpoint}:`)
    for (const p of payloads) console.log(JSON.stringify(p, null, 2))
    if (opts.keyCheck) {
      const check = await verifyKey(keyUrl, key)
      info(check.ok ? `key file OK – ${check.reason}` : `key file NOT reachable – ${check.reason}; a real run would skip the submission`)
    } else info('key file check skipped (--no-key-check)')
    summary([`Baseline: ${mode}`, '', `Dry run – ${selection.length} URL(s) would be submitted.`])
    return 0
  }

  const check = await verifyKey(keyUrl, key)
  if (!check.ok) {
    warn(`key file check failed – submission skipped (${check.reason})`)
    summary([`Baseline: ${mode}`, '', `⚠️ Key file check failed – ${selection.length} URL(s) not submitted: ${check.reason}`])
    return 0
  }

  const baseDelayMs = env.INDEXNOW_RETRY_BASE_MS !== undefined && env.INDEXNOW_RETRY_BASE_MS !== '' ? Number(env.INDEXNOW_RETRY_BASE_MS) : RETRY_BASE_MS
  const results = []
  for (const [i, payload] of payloads.entries()) {
    const result = await submit(payload, { endpoint, baseDelayMs, log: (m) => info(`request ${i + 1}/${payloads.length}: ${m}`) })
    results.push(result)
    const line = `request ${i + 1}/${payloads.length} (${payload.urlList.length} URL(s)): HTTP ${result.status ?? '–'} ${result.message} after ${result.attempts} attempt(s)`
    if (result.ok) info(line)
    else warn(line)
  }
  const sent = results.filter((r) => r.ok).length
  info(`done – ${sent}/${results.length} request(s) accepted`)
  summary([
    `Baseline: ${mode}`,
    '',
    `${sent}/${results.length} request(s) accepted, ${selection.length} URL(s):`,
    '',
    ...selection.map((s) => `- ${s.reason}: ${s.url}`),
    ...results.filter((r) => !r.ok).map((r) => `\n⚠️ HTTP ${r.status ?? '–'} ${r.message}`),
  ])
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // exitCode instead of process.exit(): exiting while fetch sockets close aborts Node on Windows.
  main().then(
    (code) => {
      process.exitCode = code
    },
    (err) => {
      // Unexpected bug: report it but never fail the deployment pipeline.
      console.log(`${process.env.GITHUB_ACTIONS === 'true' ? '::warning title=IndexNow::' : 'IndexNow WARNING: '}unexpected error – ${err?.stack ?? err}`)
      process.exitCode = 0
    },
  )
}
