/**
 * Generates public/og-image.png (1200×630, home page), public/og/blog.png and one public/og/<landing-slug>.png per
 * landing page (spec 10, AC-SEO-019) used by Open Graph / Twitter cards,
 * plus PNG favicons / apple-touch-icon, a small favicon.ico (16/32/48) and a display-size logo.webp
 * from the logo – for the landing page and the app (spec 17, AC-PERF-004: favicon ≤ 16 KB, logo.webp ≤ 12 KB).
 * logo.png stays the 500 px original (JSON-LD Organization logo, apple-touch-icon in the app).
 *
 * Run: npm run og-image   (only needed when the logo or copy changes – output is committed)
 */
import sharp from 'sharp'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { writeFile } from 'fs/promises'
import { mkdirSync, readFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '../public')
const appPublicDir = resolve(__dirname, '../../frontend/public')
const logoPath = resolve(publicDir, 'logo.png')

/** ICO container with PNG-encoded images (supported by every current browser). */
function buildIco(pngs) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngs.length, 4)
  const entries = []
  let offset = 6 + 16 * pngs.length
  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size >= 256 ? 0 : size, 0)
    entry.writeUInt8(size >= 256 ? 0 : size, 1)
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += data.length
    entries.push(entry)
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)])
}

const W = 1200
const H = 630
const FONT = 'Inter, Arial, Helvetica, sans-serif'

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Greedy word wrap by an estimated average glyph width (bold Latin ≈ 0.52 em). */
function wrap(text, fontSize, maxWidth) {
  const maxChars = Math.floor(maxWidth / (fontSize * 0.52))
  const lines = []
  for (const word of text.split(' ')) {
    const last = lines[lines.length - 1]
    if (last && `${last} ${word}`.length <= maxChars) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return lines
}

/** 1200×630 Open Graph card: title (white), accent (yellow), subtitle, footer – spec 10, AC-SEO-019. */
function ogSvg({ title, accent, subtitle }) {
  const titleLines = wrap(title, 68, 900)
  const accentLines = wrap(accent, 46, 1040)
  let y = 200
  const parts = []
  for (const line of titleLines) {
    parts.push(`<text x="80" y="${y}" font-family="${FONT}" font-size="68" font-weight="800" fill="#ffffff">${xml(line)}</text>`)
    y += 80
  }
  y += 6
  for (const line of accentLines) {
    parts.push(`<text x="80" y="${y}" font-family="${FONT}" font-size="46" font-weight="800" fill="#fde047">${xml(line)}</text>`)
    y += 58
  }
  if (subtitle) parts.push(`<text x="80" y="${Math.max(y + 20, 470)}" font-family="${FONT}" font-size="28" font-weight="500" fill="#dbeafe">${xml(subtitle)}</text>`)
  return `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="60%" stop-color="#1d4ed8"/>
      <stop offset="100%" stop-color="#3730a3"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="1080" cy="560" r="260" fill="#a5b4fc" opacity="0.15"/>
  <circle cx="120" cy="80" r="180" fill="#ffffff" opacity="0.08"/>
  ${parts.join('\n  ')}
  <text x="80" y="565" font-family="${FONT}" font-size="30" font-weight="700" fill="#ffffff">allgrafika.pl</text>
  <text x="262" y="565" font-family="${FONT}" font-size="30" font-weight="400" fill="#dbeafe">· pierwsze 5 grafik za darmo</text>
</svg>`
}

/** Landing pages from src/data/seoPages.ts – one `path:`, `h1:` and `h1Accent:` per page (single-quoted). */
function landingCards() {
  const src = readFileSync(resolve(__dirname, '../src/data/seoPages.ts'), 'utf-8')
  return [...src.matchAll(/path: '\/([a-z0-9-]+)',[\s\S]*?h1: '([^']+)',\s*h1Accent: '([^']+)',/g)].map((m) => ({ slug: m[1], title: m[2], accent: m[3] }))
}

async function writeOg(card, file, logo) {
  await sharp(Buffer.from(ogSvg(card)))
    .composite([{ input: logo, top: 40, left: W - 200 }])
    .png({ compressionLevel: 9, palette: true })
    .toFile(file)
  console.log(`✅ ${file.replace(publicDir, 'public')}`)
}

async function ogImages() {
  const logo = await sharp(logoPath).resize(160, 160, { fit: 'inside' }).png().toBuffer()
  await writeOg(
    { title: 'Zdjęcia produktowe AI', accent: 'dla sklepów internetowych i marketplace’ów', subtitle: 'Packshot, białe tło i aranżacje z jednej fotki z telefonu' },
    resolve(publicDir, 'og-image.png'),
    logo,
  )
  const ogDir = resolve(publicDir, 'og')
  mkdirSync(ogDir, { recursive: true })
  await writeOg(
    { title: 'Blog AllGrafika', accent: 'poradniki o zdjęciach produktowych i sprzedaży online', subtitle: 'Packshot · białe tło · sklep internetowy · OLX · Vinted · eBay · Amazon' },
    resolve(ogDir, 'blog.png'),
    logo,
  )
  const cards = landingCards()
  if (cards.length === 0) throw new Error('No landing pages parsed from src/data/seoPages.ts')
  for (const card of cards) await writeOg({ ...card, subtitle: 'Zdjęcia produktowe AI – produkt wierny oryginałowi' }, resolve(ogDir, `${card.slug}.png`), logo)
}

async function main() {
  await ogImages()
  // `--og` regenerates only the Open Graph images (the icons below are also copied into frontend/public).
  if (process.argv.includes('--og')) return

  for (const size of [32, 180, 192, 512]) {
    const name = size === 180 ? 'apple-touch-icon.png' : `favicon-${size}.png`
    await sharp(logoPath)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(resolve(publicDir, name))
    console.log(`✅ public/${name}`)
  }

  const icoImages = []
  for (const size of [16, 32, 48]) {
    const data = await sharp(logoPath)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png({ compressionLevel: 9, palette: true })
      .toBuffer()
    icoImages.push({ size, data })
  }
  const ico = buildIco(icoImages)
  // The navbar shows the logo at up to 48 CSS px – 160 px covers 3x screens.
  const logoWebp = await sharp(logoPath).resize(160, 160, { fit: 'inside' }).webp({ quality: 85 }).toBuffer()
  for (const dir of [publicDir, appPublicDir]) {
    await writeFile(resolve(dir, 'favicon.ico'), ico)
    await writeFile(resolve(dir, 'logo.webp'), logoWebp)
  }
  console.log(`✅ favicon.ico (${ico.length} B) and logo.webp (${logoWebp.length} B) in landing-page/public and frontend/public`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
