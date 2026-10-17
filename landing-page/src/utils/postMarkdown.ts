/**
 * The small Markdown subset used by blog posts (written by hand and by the daily bot), parsed into blocks so lists,
 * tables and check-lists become valid HTML (spec 10, AC-SEO-017) and the FAQ section can feed FAQPage JSON-LD
 * (AC-SEO-015). Inline markup (links, bold) is rendered by renderInline – everything is HTML-escaped first.
 */
import { SITE_URL } from '../data/site'

export type Block =
  { type: 'h2' | 'h3' | 'p' | 'quote'; text: string } | { type: 'ul'; items: string[]; checklist: boolean } | { type: 'ol'; items: string[] } | { type: 'table'; head: string[]; rows: string[][] }

const CHECK_RE = /^- \[[ xX]\] /
const OL_RE = /^\d+\.\s+/

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

export function parsePost(content: string): Block[] {
  const lines = content.split('\n').map((l) => l.replace(/\s+$/, ''))
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      i++
    } else if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', text: line.slice(3).trim() })
      i++
    } else if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', text: line.slice(4).trim() })
      i++
    } else if (line.startsWith('> ')) {
      blocks.push({ type: 'quote', text: line.slice(2).trim() })
      i++
    } else if (line.startsWith('- ')) {
      const items: string[] = []
      const checklist = CHECK_RE.test(line)
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].replace(CHECK_RE, '').replace(/^- /, ''))
        i++
      }
      blocks.push({ type: 'ul', items, checklist })
    } else if (OL_RE.test(line)) {
      const items: string[] = []
      while (i < lines.length && OL_RE.test(lines[i])) {
        items.push(lines[i].replace(OL_RE, ''))
        i++
      }
      blocks.push({ type: 'ol', items })
    } else if (line.trim().startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const row = cells(lines[i])
        if (!row.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(row)
        i++
      }
      const [head = [], ...body] = rows
      blocks.push({ type: 'table', head, rows: body })
    } else {
      blocks.push({ type: 'p', text: line.trim() })
      i++
    }
  }
  return blocks
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

const LINK_CLASS = 'text-blue-700 underline underline-offset-2 hover:text-blue-900 font-semibold'

/**
 * Links [text](url) and bold **text**. Links to allgrafika.pl (absolute or site-relative) become relative links that
 * stay in the same tab; links to other sites open in a new tab. Only http(s) and "/" URLs without quotes or spaces.
 */
export function renderInline(text: string): string {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)"'<>]*)\)/g, (_m, label: string, url: string) => {
      const internal = url.startsWith('/') || url === SITE_URL || url.startsWith(`${SITE_URL}/`)
      if (internal) {
        const path = url.startsWith('/') ? url : url.slice(SITE_URL.length) || '/'
        return `<a href="${path}" class="${LINK_CLASS}">${label}</a>`
      }
      if (url.startsWith('https://app.allgrafika.pl')) return `<a href="${url}" class="${LINK_CLASS}">${label}</a>`
      return `<a href="${url}" class="${LINK_CLASS}" target="_blank" rel="noopener noreferrer">${label}</a>`
    })
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
}

/** Text without Markdown – for JSON-LD. */
export function plainMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .trim()
}

/** Questions and answers of the "Najczęstsze pytania" section (### question + following blocks). */
export function extractFaq(blocks: Block[]): Array<{ q: string; a: string }> {
  const start = blocks.findIndex((b) => b.type === 'h2' && /^Najczęstsze pytania/i.test(b.text))
  if (start < 0) return []
  const faq: Array<{ q: string; a: string }> = []
  for (let i = start + 1; i < blocks.length; i++) {
    const b = blocks[i]
    if (b.type === 'h2') break
    if (b.type !== 'h3') continue
    const answer: string[] = []
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[j]
      if (a.type === 'h2' || a.type === 'h3') break
      if (a.type === 'p' || a.type === 'quote') answer.push(a.text)
      if (a.type === 'ul' || a.type === 'ol') answer.push(a.items.join('; '))
    }
    if (answer.length) faq.push({ q: plainMarkdown(b.text), a: plainMarkdown(answer.join(' ')) })
  }
  return faq
}

/** Words of the article body, for BlogPosting.wordCount. */
export function wordCount(content: string): number {
  return plainMarkdown(content.replace(/[#>|*-]/g, ' '))
    .split(/\s+/)
    .filter(Boolean).length
}
