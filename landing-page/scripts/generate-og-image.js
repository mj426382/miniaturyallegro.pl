/**
 * Generates public/og-image.png (1200×630) used by Open Graph / Twitter cards,
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

const svg = `
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
  <text x="80" y="250" font-family="Inter, Arial, Helvetica, sans-serif" font-size="72" font-weight="800" fill="#ffffff">Miniaturki Allegro</text>
  <text x="80" y="335" font-family="Inter, Arial, Helvetica, sans-serif" font-size="72" font-weight="800" fill="#fde047">generowane przez AI</text>
  <text x="80" y="415" font-family="Inter, Arial, Helvetica, sans-serif" font-size="32" font-weight="500" fill="#dbeafe">Z jednego zdjęcia produktu – 6 stylów, produkt wierny oryginałowi</text>
  <text x="80" y="545" font-family="Inter, Arial, Helvetica, sans-serif" font-size="30" font-weight="700" fill="#ffffff">allgrafika.pl</text>
  <text x="320" y="545" font-family="Inter, Arial, Helvetica, sans-serif" font-size="30" font-weight="400" fill="#bfdbfe">· pierwsze 10 grafik za darmo</text>
</svg>`

async function main() {
  const logo = await sharp(logoPath).resize(200, 200, { fit: 'inside' }).png().toBuffer()

  await sharp(Buffer.from(svg))
    .composite([{ input: logo, top: 40, left: W - 240 }])
    .png({ compressionLevel: 9 })
    .toFile(resolve(publicDir, 'og-image.png'))
  console.log('✅ public/og-image.png')

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
