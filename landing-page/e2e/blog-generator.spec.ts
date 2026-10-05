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
})
