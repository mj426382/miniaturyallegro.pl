import { test, expect } from '@playwright/test'
import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Spec 23 – the blog bot writes cross-cutting e-commerce articles from a researched topic plan, rotates clusters and
 * article types, respects seasonal windows and rejects drafts that fail the quality gates. The Python scripts are
 * exercised through their CLIs; the online loop runs against a local fake OpenAI endpoint (no real API, no keys).
 */
const landing = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const scripts = resolve(landing, 'scripts')
const planScript = resolve(scripts, 'blog_plan.py')
const qualityScript = resolve(scripts, 'blog_quality.py')
const generator = resolve(scripts, 'generate-blog-post.py')
const tmpDir = resolve(landing, 'test-results/blog-bot')
const sample = JSON.parse(readFileSync(resolve(scripts, 'fixtures/blog-post.sample.json'), 'utf-8')) as Record<string, string>
const plan = JSON.parse(readFileSync(resolve(scripts, 'blog-keywords.json'), 'utf-8')) as {
  clusters: Record<string, unknown>
  sources: Record<string, { url: string; platform: string }>
  entries: { keyword: string; cluster: string; type: string; links: string[]; season?: string }[]
}
const PY_ENV = { ...process.env, PYTHONIOENCODING: 'utf-8', BLOG_DRY_RUN: '0', OPENAI_API_KEY: '', MODELS_TOKEN: '', GITHUB_TOKEN: '', GH_TOKEN: '' }

type Topic = { date: string; keyword: string; cluster: string; type: string; season: string | null; days_before?: number }
type Report = { problems: string[]; fixes: string[]; title: string; excerpt: string; words: number; internal_links: string[] }

let seq = 0
function tmpFile(name: string, content: unknown): string {
  mkdirSync(tmpDir, { recursive: true })
  const file = resolve(tmpDir, `${process.pid}-${seq++}-${name}`)
  writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content), 'utf-8')
  return file
}

function python(args: string[], env: Record<string, string | undefined> = {}) {
  const r = spawnSync('python3', args, { env: { ...PY_ENV, ...env }, encoding: 'utf-8' })
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

function nextTopics(today: string, n: number, ledger?: unknown[]): Topic[] {
  const args = [planScript, '--next', String(n), '--today', today]
  if (ledger) args.push('--ledger', tmpFile('ledger.json', ledger))
  const r = python(args)
  expect(r.status, r.stderr).toBe(0)
  return JSON.parse(r.stdout) as Topic[]
}

function check(article: Record<string, unknown>, args: string[] = []): Report {
  const file = tmpFile('article.json', article)
  try {
    const r = python([qualityScript, '--check', file, ...args])
    expect(r.stderr).toBe('')
    return JSON.parse(r.stdout) as Report
  } finally {
    unlinkSync(file)
  }
}

/** The sample article with one extra paragraph before the "common mistakes" section. */
function withLine(line: string, extra: Record<string, unknown> = {}) {
  return { ...sample, ...extra, content: sample.content.replace('## Najczęstsze błędy', `${line}\n\n## Najczęstsze błędy`) }
}

const expectProblem = (report: Report, fragment: string) => expect(report.problems.join('\n')).toContain(fragment)

test.describe('blog bot (spec 23)', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'desktop-chrome', 'device-independent, and parallel runs would race on the same files')
  })

  test('[AC-BOT-001] the committed topic plan is valid and a broken plan is rejected', () => {
    const ok = python([planScript, '--validate'])
    expect(ok.status, ok.stdout).toBe(0)
    expect(ok.stdout).toContain('Topic plan is valid')
    expect(ok.stdout).not.toContain('problem:')
    expect(JSON.stringify(plan)).not.toMatch(/allegro/i)
    expect(Object.keys(plan.clusters).length).toBeGreaterThanOrEqual(8)
    expect(new Set(plan.entries.map((e) => e.type))).toEqual(new Set(['pillar', 'guide', 'howto', 'comparison', 'checklist', 'seasonal']))
    for (const e of plan.entries) expect(e.links.length, e.keyword).toBeGreaterThanOrEqual(2)

    const broken = structuredClone(plan) as unknown as { entries: Record<string, unknown>[] }
    broken.entries.push({ keyword: 'zdjęcia na vinted', cluster: 'nie-ma-takiego', intent: 'x', type: 'essay', priority: 7, angle: '', evidence: '', links: ['/blog/nie-ma-takiego-wpisu'] })
    const bad = python([planScript, '--validate', '--plan', tmpFile('plan.json', broken)])
    expect(bad.status).toBe(1)
    for (const fragment of ['unknown cluster', 'type must be one of', 'priority must be', 'missing evidence', 'is not a live page', 'belongs to the landing page']) {
      expect(bad.stdout).toContain(fragment)
    }
  })

  test('[AC-BOT-002] the next 30 articles rotate clusters and types, include pillar guides and follow the Mon/Wed/Fri schedule', () => {
    const topics = nextTopics('2026-10-17', 30)
    expect(topics).toHaveLength(30)
    for (let i = 1; i < topics.length; i++) {
      expect(topics[i].cluster, `${topics[i - 1].keyword} → ${topics[i].keyword}`).not.toBe(topics[i - 1].cluster)
      expect(topics[i].type, `${topics[i - 1].keyword} → ${topics[i].keyword}`).not.toBe(topics[i - 1].type)
    }
    expect(new Set(topics.map((t) => t.cluster)).size).toBe(8)
    const pillars = topics.map((t, i) => (t.type === 'pillar' ? i : -1)).filter((i) => i >= 0)
    const pillarsInPlan = plan.entries.filter((e) => e.type === 'pillar').length
    expect(pillars.length).toBe(pillarsInPlan)
    expect(pillars[0]).toBeLessThanOrEqual(6)
    for (let i = 1; i < pillars.length; i++) expect(pillars[i] - pillars[i - 1]).toBeLessThanOrEqual(7)
    for (const t of topics) expect([1, 3, 5], t.date).toContain(new Date(`${t.date}T12:00:00Z`).getUTCDay())
  })

  test('[AC-BOT-003] seasonal topics are written 6 to 3 weeks before the event and never outside that window', () => {
    // 2026-10-19 (Monday) is 39 days before Black Friday 2026 (27 November).
    const [first] = nextTopics('2026-10-17', 1)
    expect(first).toMatchObject({ date: '2026-10-19', keyword: 'black friday 2026', season: 'black-friday', days_before: 39 })

    // A whole year of the schedule: every seasonal topic lands inside its window.
    const year = nextTopics('2026-07-01', plan.entries.length)
    const seasonal = year.filter((t) => t.season)
    expect(seasonal.length).toBe(plan.entries.filter((e) => e.season).length)
    for (const t of seasonal) {
      expect(t.days_before, t.keyword).toBeGreaterThanOrEqual(21)
      expect(t.days_before, t.keyword).toBeLessThanOrEqual(42)
    }
    // From 1 July the first weeks bring no Black Friday or Christmas topic.
    const july = nextTopics('2026-07-01', 6)
    expect(july.some((t) => t.season === 'black-friday' || t.season === 'boze-narodzenie')).toBe(false)
  })

  test('[AC-BOT-004] a two-word head term is not taken by a narrower post, a fully covered keyword still is', () => {
    const code = [
      'import sys, json',
      `sys.path.insert(0, ${JSON.stringify(scripts)})`,
      'from blog_similarity import keyword_taken',
      'from check_blog_duplicates import load_posts',
      'posts = load_posts()',
      'narrow = [{"slug": "biale-tlo-diy-vs-ai-w-fotografii-produktowej", "title": "Białe tło w fotografii produktowej: DIY vs. AI"}]',
      'same = [{"slug": "fotografia-produktowa-poradnik", "title": "Fotografia produktowa – poradnik"}]',
      'print(json.dumps([bool(keyword_taken("fotografia produktowa", narrow)), bool(keyword_taken("fotografia produktowa", same)), bool(keyword_taken("jak fotografować buty do sprzedaży", posts))]))',
    ].join('\n')
    const r = python(['-c', code])
    expect(r.stderr).toBe('')
    expect(JSON.parse(r.stdout)).toEqual([false, true, true])
  })

  test('[AC-BOT-005] structure gates per article type; the dry-run sample passes as a guide only', () => {
    const asGuide = check(sample, ['--type', 'guide'])
    expect(asGuide.problems).toEqual([])
    expect(asGuide.words).toBeGreaterThanOrEqual(1000)

    const asPillar = check(sample, ['--type', 'pillar'])
    for (const fragment of ['za krótka treść (1', 'pillar wymaga min. 1800', 'sekcja FAQ ma 4 pytań']) expectProblem(asPillar, fragment)

    expectProblem(check({ ...sample, content: sample.content.replace('## Najczęstsze pytania', '## Pytania od czytelników') }), "brak sekcji '## Najczęstsze pytania'")
    expectProblem(check(withLine('| Kryterium | Opcja |\n|---|---|\n| koszt | niski |')), 'tabelę Markdown')
    expectProblem(check({ ...sample, content: `# Zdjęcia szkła\n\n${sample.content}` }), 'nagłówek H1')
    const truncated = check({ ...sample, content: sample.content.split('## Ustawienie telefonu')[0] + '[← Przejdź do AllGrafika.pl](https://allgrafika.pl/)' })
    for (const fragment of ['za krótka treść', 'za mało sekcji H2 (3)', 'za mało linków wewnętrznych (1)']) expectProblem(truncated, fragment)
    expectProblem(check(sample, ['--type', 'howto']), "'### Krok 1: …'")
    expectProblem(check(sample, ['--type', 'seasonal']), 'Harmonogram')
  })

  test('[AC-BOT-006] internal links must be live pages, merged posts are relinked, external links only from the source registry', () => {
    expectProblem(check(withLine('Zobacz też [stary poradnik](https://allgrafika.pl/blog/nie-ma-takiego-wpisu).')), 'nieistniejącej strony: /blog/nie-ma-takiego-wpisu')
    expectProblem(check(withLine('Więcej w [poradniku](https://przyklad-bloga.pl/zdjecia-szkla).')), 'spoza listy oficjalnych źródeł')
    const official = Object.values(plan.sources)[0].url
    expect(check(withLine(`Szczegóły znajdziesz w [oficjalnej pomocy](${official}).`)).problems.join('\n')).not.toContain('spoza listy')

    const noLinks = { ...sample, content: sample.content.replace(/\[([^\]]+)\]\(https:\/\/allgrafika\.pl\/(?!\))[^)]*\)/g, '$1') }
    expectProblem(check(noLinks), 'za mało linków wewnętrznych (0)')
    expectProblem(check(sample, ['--links', '/blog/seo-zdjec-produktowych']), 'brak linku do żadnej z zaplanowanych stron')

    const vercel = JSON.parse(readFileSync(resolve(landing, 'vercel.json'), 'utf-8')) as { redirects: { source: string; destination: string }[] }
    const merged = vercel.redirects.find((r) => r.source.startsWith('/blog/') && r.destination.startsWith('/blog/') && !/allegro/i.test(r.source + r.destination))!
    const relinked = check(withLine(`Podobny temat: [połączony wpis](https://allgrafika.pl${merged.source}).`))
    expect(relinked.problems).toEqual([])
    expect(relinked.fixes.join('\n')).toContain(`${merged.source} → ${merged.destination}`)
    expect(relinked.internal_links).toContain(merged.destination)
    expect(relinked.internal_links).not.toContain(merged.source)
  })

  test('[AC-BOT-007] meta title and description are shortened in code instead of rejecting the draft', () => {
    const long = check({
      ...sample,
      title: 'Jak fotografować szkło i przedmioty odbijające światło – poradnik krok po kroku dla sprzedawców w 2026',
      excerpt: `${sample.excerpt} Dodatkowo dowiesz się, jak dobrać tło, które ukryje refleksy, i jakie zdjęcia dodatkowe pokazać w ofercie sklepu.`,
    })
    expect(long.problems).toEqual([])
    expect(long.title.length).toBeLessThanOrEqual(60)
    expect(long.title).toBe('Jak fotografować szkło i przedmioty odbijające światło')
    expect(long.excerpt.length).toBeLessThanOrEqual(158)
    expect(long.excerpt).not.toMatch(/\s(i|a|w|z|na|do|oraz|lub)\.?$/)
    expect(long.fixes.join('\n')).toContain('tytuł skrócony')
    expectProblem(check({ ...sample, title: 'Zdjęcia szkła' }), 'tytuł ma 13 znaków')
  })

  test('[AC-BOT-008] invented statistics, research claims and case studies are rejected; sourced numbers are allowed', () => {
    expectProblem(check(withLine('Po tej zmianie sprzedaż wzrosła o 35% w miesiąc.')), 'procentowy wzrost')
    expectProblem(check(withLine('Aż 67% kupujących ogląda wszystkie zdjęcia przed zakupem.')), 'liczba procentowa bez oficjalnego źródła')
    expectProblem(check(withLine('Badania pokazują, że kupujący wolą jasne zdjęcia szkła.')), 'badania/statystyki bez źródła')
    expectProblem(check(withLine('Aż 3 na 4 klientów wraca do sklepu z dobrymi zdjęciami.')), 'badania/statystyki bez źródła')
    expectProblem(check(withLine('Nasz klient sprzedał w ten sposób cały magazyn kieliszków.')), 'case study')

    const amazon = plan.sources['amazon-product-images'].url
    expect(check(withLine(`Na Amazon produkt na zdjęciu głównym zajmuje co najmniej 85% kadru – zobacz [wymagania Amazon](${amazon}).`)).problems).toEqual([])
    expect(check(withLine('Plakietkę „-20%” dodawaj tylko na zdjęciach dodatkowych w swoim sklepie.')).problems).toEqual([])
  })

  test('[AC-BOT-009] platform rules need an official source in the section and must match the platform policies', () => {
    expectProblem(check(withLine('eBay pozwala dodać 24 zdjęcia w jednej ofercie.')), 'platformy ebay bez linku do oficjalnego źródła')
    const ebay = plan.sources['ebay-adding-pictures'].url
    expect(check(withLine(`eBay pozwala dodać 24 zdjęcia w jednej ofercie – zobacz [pomoc eBay](${ebay}).`)).problems).toEqual([])

    expectProblem(check(withLine('Na Vinted wrzuć grafikę z AllGrafika ze sceną lifestyle.')), 'Vinted wymaga własnych, nieedytowanych zdjęć')
    expectProblem(check(withLine('Na eBay dodaj znak wodny ze swoim logo na każdym zdjęciu.')), 'eBay zabrania dodanych napisów')
    expectProblem(check(withLine('Na Amazon jako zdjęcie główne wstaw scenę lifestyle z kieliszkami.')), 'zdjęcie główne na Amazon')
  })

  test('[AC-BOT-010] competitor bashing, superlatives, false promises, wrong free credits and a missing CTA are rejected', () => {
    expectProblem(check(withLine('Canva jest słaba do zdjęć szkła, lepiej jej unikać.')), 'nie oceniaj negatywnie')
    expectProblem(check(withLine('AllGrafika to najlepsze narzędzie do zdjęć na rynku.')), 'superlatyw')
    expectProblem(check(withLine('Gwarantujemy wzrost sprzedaży po zmianie zdjęć.')), 'superlatyw')
    expectProblem(check(withLine('AllGrafika automatycznie opublikuje ofertę na OLX za Ciebie.')), 'nie łączy się z platformami')
    expectProblem(check(withLine('AllGrafika korzysta z własnego modelu AI.')), 'nie ma własnego modelu AI')
    expectProblem(check(withLine('Na start dostajesz 10 darmowych grafik.')), 'nowe konto ma 5 darmowych grafik (nie 10)')
    const noCta = sample.content.replace('[AllGrafika.pl](https://app.allgrafika.pl/register)', 'AllGrafika.pl').replace(/\[([^\]]+)\]\(https:\/\/allgrafika\.pl\/biale-tlo-zdjecie-produktu\)/, '$1')
    expectProblem(check({ ...sample, content: noCta }), 'brak uczciwego CTA')
  })

  test('[AC-BOT-011] online: a rejected draft is regenerated with the reasons, the accepted one is published and summarised', async () => {
    const good = { slug: sample.slug, title: sample.title, excerpt: sample.excerpt, content: sample.content }
    const bad = { ...good, content: withLine('Sprzedawcy, którzy tak robią, zwiększyli sprzedaż o 40%.').content }
    const requests: { messages: { role: string; content: string }[] }[] = []
    const server = createServer((req, res) => {
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        requests.push(JSON.parse(body))
        const article = requests.length === 1 ? bad : good
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(article) } }] }))
      })
    })
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
    const port = (server.address() as AddressInfo).port

    // The plan with one extra topic matching the sample; every other topic is already used.
    const testPlan = structuredClone(plan) as unknown as { entries: Record<string, unknown>[] }
    testPlan.entries.push({
      keyword: 'jak fotografować szkło',
      cluster: 'fotografia-produktowa',
      intent: 'poradnikowa',
      type: 'guide',
      priority: 1,
      angle: 'test',
      evidence: 'test',
      links: ['/blog/oswietlenie-diy-do-zdjec-produktowych', '/biale-tlo-zdjecie-produktu'],
    })
    const ledgerFile = tmpFile(
      'ledger.json',
      plan.entries.map((e) => ({ keyword: e.keyword, slug: 'x', date: '2026-10-01', covered: true })),
    )
    const summaryFile = tmpFile('summary.md', '')
    const outputFile = tmpFile('output.txt', '')
    // A private copy of the posts (without the sample, which blog-generator.spec.ts may be writing right now) and of the sitemap.
    const postsDir = resolve(tmpDir, `${process.pid}-posts`)
    rmSync(postsDir, { recursive: true, force: true })
    cpSync(resolve(landing, 'src/data/blogPosts'), postsDir, { recursive: true, filter: (src) => !src.endsWith(`${sample.slug}.ts`) })
    const postFile = resolve(postsDir, `${sample.slug}.ts`)
    const sitemap = tmpFile('sitemap.xml', '')
    try {
      const result = await new Promise<{ code: number | null; out: string }>((done) => {
        const child = spawn('python3', [generator], {
          env: {
            ...PY_ENV,
            OPENAI_API_KEY: 'test-key-not-real',
            BLOG_OPENAI_URL: `http://127.0.0.1:${port}/v1/chat/completions`,
            BLOG_PUBLISH: 'direct',
            BLOG_PLAN_FILE: tmpFile('plan.json', testPlan),
            BLOG_LEDGER_FILE: ledgerFile,
            GITHUB_STEP_SUMMARY: summaryFile,
            GITHUB_OUTPUT: outputFile,
            BLOG_POSTS_DIR: postsDir,
            BLOG_SITEMAP_FILE: sitemap,
          },
        })
        let out = ''
        child.stdout.on('data', (c) => (out += c))
        child.stderr.on('data', (c) => (out += c))
        child.on('close', (code) => done({ code, out }))
      })
      expect(result.code, result.out).toBe(0)
      expect(requests).toHaveLength(2)
      const secondPrompt = requests[1].messages.find((m) => m.role === 'user')!.content
      expect(secondPrompt).toContain('POPRZEDNIA WERSJA ZOSTAŁA ODRZUCONA')
      expect(secondPrompt).toContain('procentowy wzrost')
      expect(requests[0].messages.find((m) => m.role === 'user')!.content).toContain('fraza główna: "jak fotografować szkło"')

      expect(existsSync(postFile)).toBe(true)
      expect(readFileSync(postFile, 'utf-8')).not.toContain('40%')
      const ledger = JSON.parse(readFileSync(ledgerFile, 'utf-8')) as Record<string, unknown>[]
      expect(ledger.at(-1)).toMatchObject({ keyword: 'jak fotografować szkło', slug: sample.slug, cluster: 'fotografia-produktowa', type: 'guide' })
      expect(readFileSync(outputFile, 'utf-8')).toContain(`slug=${sample.slug}`)
      const summary = readFileSync(summaryFile, 'utf-8')
      expect(summary).toContain('jak fotografować szkło')
      expect(summary).toContain('Szkic 1 odrzucony')
      expect(summary).toContain(`/blog/${sample.slug}`)
      expect(readFileSync(sitemap, 'utf-8')).toContain(`https://allgrafika.pl/blog/${sample.slug}`)
    } finally {
      server.close()
      rmSync(postsDir, { recursive: true, force: true })
    }
  })

  test('[AC-BOT-012] the workflow runs Mon/Wed/Fri, keeps every gate before publishing and always writes a summary', () => {
    const workflow = readFileSync(resolve(landing, '../.github/workflows/daily-blog.yml'), 'utf-8')
    expect(workflow).toContain('cron: "0 6 * * 1,3,5"')
    expect(readFileSync(planScript, 'utf-8')).toContain('PUBLISH_WEEKDAYS = (0, 2, 4)')
    expect(workflow).toMatch(/workflow_dispatch:\s*\n\s*inputs:\s*\n\s*dry_run:/)
    const order = ['blog_plan.py --validate', 'generate-blog-post.py', 'check_blog_duplicates.py', 'npm run lint', 'npm run format:check', 'npm run build', 'git push origin HEAD:main']
    const positions = order.map((step) => workflow.indexOf(step))
    for (const [i, p] of positions.entries()) expect(p, order[i]).toBeGreaterThan(-1)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    expect(workflow).toContain("if: steps.article.outputs.slug != '' && inputs.dry_run != true")
    expect(workflow).toMatch(/- name: Run summary\s*\n\s*if: always\(\)/)
    expect(new Set([...workflow.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]))).toEqual(new Set(['GITHUB_TOKEN', 'OPENAI_API_KEY']))
  })

  test('[AC-BOT-013] with the plan used up the bot writes nothing, calls no API and leaves a warning', () => {
    const ledgerFile = tmpFile(
      'ledger.json',
      plan.entries.map((e) => ({ keyword: e.keyword, slug: 'x', date: '2026-10-01' })),
    )
    const summaryFile = tmpFile('summary.md', '')
    const r = python([generator], { BLOG_PUBLISH: 'direct', BLOG_LEDGER_FILE: ledgerFile, GITHUB_STEP_SUMMARY: summaryFile, OPENAI_API_KEY: '' })
    expect(r.status, r.stdout + r.stderr).toBe(0)
    expect(r.stdout).toContain('Brak artykułu dziś')
    expect(r.stdout).not.toContain('HTTP')
    expect(readFileSync(summaryFile, 'utf-8')).toContain('plan exhausted')
  })
})
