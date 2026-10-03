/**
 * Generates public/og-image.png (1200×630) used by Open Graph / Twitter cards,
 * plus PNG favicons / apple-touch-icon from the logo.
 *
 * Run: npm run og-image   (only needed when the logo or copy changes – output is committed)
 */
import sharp from 'sharp'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '../public')
const logoPath = resolve(publicDir, 'logo.png')

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
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
