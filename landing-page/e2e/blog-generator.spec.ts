import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The daily blog bot (scripts/generate-blog-post.py) must keep producing files the build understands:
 * run it in dry-run mode with the sample article and check the files it produces, then restore.
 */
const landing = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const script = resolve(landing, 'scripts/generate-blog-post.py')
const sample = JSON.parse(readFileSync(resolve(landing, 'scripts/fixtures/blog-post.sample.json'), 'utf-8'))
const postFile = resolve(landing, `src/data/blogPosts/${sample.slug}.ts`)
const sitemap = resolve(landing, 'public/sitemap.xml')

test.describe('daily blog generator', () => {
  // Runs once: it does not depend on the device, and parallel runs would race on the same files.
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'desktop-chrome', 'device-independent')
  })

  test('[AC-SEO-004] dry run writes a valid post, lists it in the index and refreshes the sitemap', () => {
    const sitemapBefore = readFileSync(sitemap, 'utf-8')
    try {
      const output = execFileSync('python3', [script], {
        env: { ...process.env, BLOG_DRY_RUN: '1', PYTHONIOENCODING: 'utf-8' },
        encoding: 'utf-8',
      })
      expect(output).toContain('DRY RUN')
      expect(output).toContain('would push branch')

      expect(existsSync(postFile)).toBe(true)
      const post = readFileSync(postFile, 'utf-8')
      expect(post).toContain(`slug: '${sample.slug}'`)
      expect(post).toContain("import type { BlogPostData } from '../blogPosts'")
      expect(post).toContain('[← Przejdź do AllGrafika.pl](https://allgrafika.pl/)')

      // The listing index is generated from the directory – the new post must appear exactly once.
      execFileSync('node', [resolve(landing, 'scripts/generate-blog-index.js')], { encoding: 'utf-8' })
      const index = readFileSync(resolve(landing, 'src/data/blogIndex.ts'), 'utf-8')
      expect(index.split(`"slug": "${sample.slug}"`).length).toBe(2)

      const sitemapAfter = readFileSync(sitemap, 'utf-8')
      expect(sitemapAfter).toContain(`https://allgrafika.pl/blog/${sample.slug}`)
    } finally {
      if (existsSync(postFile)) unlinkSync(postFile)
      writeFileSync(sitemap, sitemapBefore, 'utf-8')
      execFileSync('node', [resolve(landing, 'scripts/generate-blog-index.js')], { encoding: 'utf-8' })
    }
  })

  test('[AC-SEO-005] a second run with the same article is skipped as a duplicate', () => {
    const sitemapBefore = readFileSync(sitemap, 'utf-8')
    try {
      execFileSync('python3', [script], { env: { ...process.env, BLOG_DRY_RUN: '1', PYTHONIOENCODING: 'utf-8' }, encoding: 'utf-8' })
      const second = execFileSync('python3', [script], { env: { ...process.env, BLOG_DRY_RUN: '1', PYTHONIOENCODING: 'utf-8' }, encoding: 'utf-8' })
      expect(second).toContain('already exists')
    } finally {
      if (existsSync(postFile)) unlinkSync(postFile)
      writeFileSync(sitemap, sitemapBefore, 'utf-8')
    }
  })

  test('[AC-SEO-006] a rewrite of an existing post is rejected and the blog has no duplicates', () => {
    // The whole blog passes the build-time guard.
    const guard = execFileSync('python3', [resolve(landing, 'scripts/check_blog_duplicates.py')], { env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, encoding: 'utf-8' })
    expect(guard).toContain('No duplicate blog posts')

    // A "new" article that reuses an existing one with a reworded title and slug.
    const source = readFileSync(resolve(landing, 'src/data/blogPosts/jak-napisac-skuteczny-tytul-aukcji-allegro.ts'), 'utf-8')
    const content = source.match(/content:\s*`([\s\S]*?)`\s*,?\s*\n/)![1]
    const fixture = resolve(landing, 'test-results/duplicate-article.json')
    writeFileSync(
      fixture,
      JSON.stringify({ slug: 'skuteczny-tytul-oferty-allegro-poradnik', title: 'Skuteczny tytuł oferty Allegro – jak go napisać', excerpt: 'x', category: 'Poradniki', readTime: 5, content }),
      'utf-8',
    )
    const sitemapBefore = readFileSync(sitemap, 'utf-8')
    let output = ''
    try {
      execFileSync('python3', [script], { env: { ...process.env, BLOG_DRY_RUN: '1', BLOG_FIXTURE: fixture, PYTHONIOENCODING: 'utf-8' }, encoding: 'utf-8' })
    } catch (err: any) {
      output = String(err.stdout)
    } finally {
      writeFileSync(sitemap, sitemapBefore, 'utf-8')
      unlinkSync(fixture)
    }
    expect(output).toMatch(/zbyt podobn\w+ do (istniejącego )?wpisu 'jak-napisac-skuteczny-tytul-aukcji-allegro'/)
    expect(existsSync(resolve(landing, 'src/data/blogPosts/skuteczny-tytul-oferty-allegro-poradnik.ts'))).toBe(false)
  })
})
