import { describe, expect, it } from 'vitest'
import { allegroHtmlToText, compactAllegroHtml, formatAllegroHtml, sanitizeAllegroHtml, splitKeywords } from './allegroHtml'

describe('sanitizeAllegroHtml', () => {
  it('[AC-DESC-006] keeps only Allegro tags and strips attributes and scripts', () => {
    const dirty = '<h1 class="x">Tytuł</h1><p onclick="a()">Tekst <strong>mocny</strong> <a href="#">link</a></p><script>x()</script><img src=x onerror=y>'
    expect(sanitizeAllegroHtml(dirty)).toBe('<h2>Tytuł</h2><p>Tekst <b>mocny</b> link</p>')
  })

  it('escapes stray angle brackets', () => {
    expect(sanitizeAllegroHtml('<p>a < b</p>')).toBe('<p>a &lt; b</p>')
  })
})

describe('allegroHtmlToText', () => {
  it('turns lists and headings into readable lines', () => {
    expect(allegroHtmlToText('<h2>Cechy</h2><ul><li>lekki</li><li>mocny</li></ul><p>Koniec &amp; kropka</p>')).toBe('Cechy\n• lekki\n• mocny\nKoniec & kropka')
  })
})

describe('formatAllegroHtml', () => {
  it('puts block tags on their own lines for editing', () => {
    expect(formatAllegroHtml('<h2>A</h2><p>b</p><ul><li>c</li></ul>')).toBe('<h2>A</h2>\n<p>b</p>\n<ul>\n  <li>c</li>\n</ul>')
  })
})

describe('compactAllegroHtml', () => {
  it('[AC-DESC-013] round-trips the formatted HTML back to the compact form', () => {
    const compact = '<h2>A</h2><p>b c</p><ul><li>c</li></ul>'
    expect(compactAllegroHtml(formatAllegroHtml(compact))).toBe(compact)
  })
})

describe('splitKeywords', () => {
  it('splits on commas and newlines, lowercases and dedupes', () => {
    expect(splitKeywords('Kubek, kubek ceramiczny\nKUBEK; biały kubek, ')).toEqual(['kubek', 'kubek ceramiczny', 'biały kubek'])
  })
})
