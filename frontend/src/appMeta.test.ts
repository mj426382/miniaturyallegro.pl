import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const root = resolve(__dirname, '..')
const read = (file: string) => readFileSync(resolve(root, file), 'utf-8')

describe('app search and share signals', () => {
  it('[AC-UI-009] is noindex everywhere, readable for crawlers and has a share preview', () => {
    const html = read('index.html')
    expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/)
    expect(html).toMatch(/<meta property="og:title" content="[^"]+"/)
    expect(html).toMatch(/<meta property="og:description" content="[^"]*sklepu internetowego[^"]*"/)
    expect(html).toMatch(/<meta property="og:image" content="https:\/\/allgrafika\.pl\/og-image\.png"/)
    expect(html).not.toMatch(/allegro/i)

    const vercel = JSON.parse(read('vercel.json'))
    const headers = vercel.headers.flatMap((h: { headers: Array<{ key: string; value: string }> }) => h.headers)
    expect(headers).toContainEqual({ key: 'X-Robots-Tag', value: 'noindex, nofollow' })

    // A Disallow would hide the noindex signals and leave bare URLs in search results.
    expect(read('public/robots.txt')).not.toMatch(/^Disallow:\s*\/\s*$/m)
  })
})
