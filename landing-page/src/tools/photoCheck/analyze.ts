/**
 * Spec 25 (AC-TOOL-001/002): local analysis of a product photo – pure functions on bytes and pixels, no DOM and no
 * network, so they run the same in the browser and in the Node unit tests. Dimensions are read from the file header
 * (works for HEIC/AVIF even when the browser cannot display them); pixels come from browser.ts.
 */
export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'heic' | 'avif' | 'gif' | 'bmp' | 'tiff' | 'unknown'

export const FORMAT_LABEL: Record<ImageFormat, string> = {
  jpeg: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
  heic: 'HEIC',
  avif: 'AVIF',
  gif: 'GIF',
  bmp: 'BMP',
  tiff: 'TIFF',
  unknown: 'nieznany',
}

export interface HeaderInfo {
  format: ImageFormat
  /** Displayed size (after the EXIF / HEIF rotation), null when the header cannot be read. */
  width: number | null
  height: number | null
  /** The file stores the picture rotated by 90° and asks the viewer to turn it (EXIF orientation 5–8, HEIF irot). */
  rotatedByMetadata: boolean
  /** The format declares an alpha channel (PNG colour type / tRNS, WebP alpha flag, HEIF alpha item); null = not known from the header. */
  hasAlphaChannel: boolean | null
}

export type Orientation = 'square' | 'landscape' | 'portrait' | 'panorama' | 'tall'

export interface RatioInfo {
  /** width / height */
  value: number
  /** "4:3", "≈ 16:9" or "2,37:1" */
  label: string
  /** Nearest common ratio within 1% (e.g. [16, 9]) or null. */
  common: [number, number] | null
}

export type BackgroundVerdict = 'white' | 'light' | 'not-white' | 'transparent'

export interface PixelStats {
  /** Share of all sampled pixels with alpha < 255. */
  transparentShare: number
  border: {
    sampled: number
    /** R, G, B ≥ 254 and opaque – "pure white" with a tolerance of 1 for JPEG compression. */
    pureWhiteShare: number
    /** R, G, B ≥ 235 and opaque. */
    nearWhiteShare: number
    /** alpha < 128 */
    transparentShare: number
    verdict: BackgroundVerdict
  }
}

export interface ImageAnalysis extends HeaderInfo {
  name: string
  bytes: number
  megapixels: number | null
  ratio: RatioInfo | null
  orientation: Orientation | null
  /** Filled in the browser after decoding; null when the browser cannot decode the file (e.g. HEIC in Chrome). */
  pixels: PixelStats | null
  /** Human-readable reason when the file cannot be analysed (corrupted, not an image, empty). */
  error: string | null
}

// ── byte helpers ─────────────────────────────────────────────────────────────

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1]
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8)
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16)
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + ((b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3])
const u32le = (b: Uint8Array, i: number) => ((b[i + 3] << 24) >>> 0) + ((b[i + 2] << 16) | (b[i + 1] << 8) | b[i])
const i32le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)
const ascii = (b: Uint8Array, i: number, n: number) => (i + n <= b.length ? String.fromCharCode(...b.subarray(i, i + n)) : '')

function indexOfAscii(b: Uint8Array, needle: string, from = 0, to = b.length): number {
  const codes = [...needle].map((c) => c.charCodeAt(0))
  const end = Math.min(to, b.length) - codes.length
  outer: for (let i = from; i <= end; i++) {
    for (let j = 0; j < codes.length; j++) if (b[i + j] !== codes[j]) continue outer
    return i
  }
  return -1
}

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'])

/** Format from the magic bytes – the file name and the browser's MIME type are not trusted. */
export function sniffFormat(b: Uint8Array): ImageFormat {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png'
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp'
  if (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a') return 'gif'
  if (ascii(b, 0, 2) === 'BM' && b.length >= 26) return 'bmp'
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a)) return 'tiff'
  if (ascii(b, 4, 4) === 'ftyp') {
    const size = Math.min(u32be(b, 0), b.length, 512)
    const brands: string[] = [ascii(b, 8, 4)]
    for (let i = 16; i + 4 <= size; i += 4) brands.push(ascii(b, i, 4))
    if (brands.includes('avif') || brands.includes('avis')) return 'avif'
    if (brands.some((x) => HEIC_BRANDS.has(x))) return 'heic'
  }
  return 'unknown'
}

// ── per-format headers ───────────────────────────────────────────────────────

interface RawHeader {
  width: number | null
  height: number | null
  rotated: boolean
  alpha: boolean | null
}

/** TIFF structure (also the payload of the JPEG EXIF segment): reads IFD0 tags. */
function readTiffTags(b: Uint8Array, start: number, end: number, wanted: number[]): Map<number, number> {
  const out = new Map<number, number>()
  if (start + 8 > end) return out
  const le = b[start] === 0x49
  const r16 = (i: number) => (le ? u16le(b, i) : u16be(b, i))
  const r32 = (i: number) => (le ? u32le(b, i) : u32be(b, i))
  const ifd = start + r32(start + 4)
  if (ifd + 2 > end) return out
  const count = r16(ifd)
  for (let n = 0; n < count; n++) {
    const e = ifd + 2 + n * 12
    if (e + 12 > end) break
    const tag = r16(e)
    if (!wanted.includes(tag)) continue
    const type = r16(e + 2)
    out.set(tag, type === 3 ? r16(e + 8) : r32(e + 8))
  }
  return out
}

function readJpeg(b: Uint8Array): RawHeader {
  let i = 2
  let orientation = 1
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) break
    const marker = b[i + 1]
    if (marker === 0xff) {
      i++
      continue
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2
      continue
    }
    if (marker === 0xd9 || marker === 0xda) break
    const len = u16be(b, i + 2)
    if (len < 2) break
    if (marker === 0xe1 && ascii(b, i + 4, 6) === 'Exif\0\0') {
      orientation = readTiffTags(b, i + 10, Math.min(i + 2 + len, b.length), [0x0112]).get(0x0112) ?? 1
    }
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isSof) {
      if (i + 9 > b.length) break
      const height = u16be(b, i + 5)
      const width = u16be(b, i + 7)
      if (!width || !height) break
      const rotated = orientation >= 5 && orientation <= 8
      return { width: rotated ? height : width, height: rotated ? width : height, rotated, alpha: false }
    }
    i += 2 + len
  }
  return { width: null, height: null, rotated: false, alpha: false }
}

function readPng(b: Uint8Array): RawHeader {
  if (b.length < 26 || ascii(b, 12, 4) !== 'IHDR') return { width: null, height: null, rotated: false, alpha: null }
  const width = u32be(b, 16)
  const height = u32be(b, 20)
  const colorType = b[25]
  let alpha = colorType === 4 || colorType === 6
  if (!alpha) {
    let i = 8
    while (i + 8 <= b.length) {
      const len = u32be(b, i)
      const type = ascii(b, i + 4, 4)
      if (type === 'tRNS') {
        alpha = true
        break
      }
      if (type === 'IDAT' || type === 'IEND') break
      i += 12 + len
    }
  }
  return width && height ? { width, height, rotated: false, alpha } : { width: null, height: null, rotated: false, alpha: null }
}

function readWebp(b: Uint8Array): RawHeader {
  const chunk = ascii(b, 12, 4)
  if (chunk === 'VP8 ' && b.length >= 30 && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff, rotated: false, alpha: false }
  }
  if (chunk === 'VP8L' && b.length >= 25 && b[20] === 0x2f) {
    const bits = u32le(b, 21)
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, rotated: false, alpha: ((bits >>> 28) & 1) === 1 }
  }
  if (chunk === 'VP8X' && b.length >= 30) {
    return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1, rotated: false, alpha: (b[20] & 0x10) !== 0 }
  }
  return { width: null, height: null, rotated: false, alpha: null }
}

/** HEIC / AVIF (ISO BMFF): the largest `ispe` box is the primary image (tiles and thumbnails are smaller), `irot` turns it. */
function readHeif(b: Uint8Array): RawHeader {
  const limit = Math.min(b.length, 1 << 20)
  let best: { w: number; h: number } | null = null
  for (let i = indexOfAscii(b, 'ispe', 0, limit); i >= 0; i = indexOfAscii(b, 'ispe', i + 4, limit)) {
    if (i + 16 > b.length) break
    const w = u32be(b, i + 8)
    const h = u32be(b, i + 12)
    if (w && h && (!best || w * h > best.w * best.h)) best = { w, h }
  }
  if (!best) return { width: null, height: null, rotated: false, alpha: null }
  const irot = indexOfAscii(b, 'irot', 0, limit)
  const angle = irot >= 0 && irot + 4 < b.length ? b[irot + 4] & 3 : 0
  const rotated = angle === 1 || angle === 3
  const alpha = indexOfAscii(b, 'auxiliary:alpha', 0, limit) >= 0 || indexOfAscii(b, 'auxid:1', 0, limit) >= 0
  return { width: rotated ? best.h : best.w, height: rotated ? best.w : best.h, rotated, alpha }
}

function readGif(b: Uint8Array): RawHeader {
  return b.length >= 10 ? { width: u16le(b, 6) || null, height: u16le(b, 8) || null, rotated: false, alpha: null } : { width: null, height: null, rotated: false, alpha: null }
}

function readBmp(b: Uint8Array): RawHeader {
  const width = i32le(b, 18)
  const height = Math.abs(i32le(b, 22))
  return width > 0 && height > 0 ? { width, height, rotated: false, alpha: null } : { width: null, height: null, rotated: false, alpha: null }
}

function readTiff(b: Uint8Array): RawHeader {
  const tags = readTiffTags(b, 0, Math.min(b.length, 1 << 20), [256, 257, 0x0112])
  const w = tags.get(256)
  const h = tags.get(257)
  if (!w || !h) return { width: null, height: null, rotated: false, alpha: null }
  const o = tags.get(0x0112) ?? 1
  const rotated = o >= 5 && o <= 8
  return { width: rotated ? h : w, height: rotated ? w : h, rotated, alpha: null }
}

export function readHeader(b: Uint8Array): HeaderInfo {
  const format = sniffFormat(b)
  const raw: RawHeader =
    format === 'jpeg'
      ? readJpeg(b)
      : format === 'png'
        ? readPng(b)
        : format === 'webp'
          ? readWebp(b)
          : format === 'heic' || format === 'avif'
            ? readHeif(b)
            : format === 'gif'
              ? readGif(b)
              : format === 'bmp'
                ? readBmp(b)
                : format === 'tiff'
                  ? readTiff(b)
                  : { width: null, height: null, rotated: false, alpha: null }
  return { format, width: raw.width, height: raw.height, rotatedByMetadata: raw.rotated, hasAlphaChannel: raw.alpha }
}

// ── derived facts ────────────────────────────────────────────────────────────

const COMMON_RATIOS: Array<[number, number]> = [
  [1, 1],
  [4, 3],
  [3, 4],
  [3, 2],
  [2, 3],
  [16, 9],
  [9, 16],
  [4, 5],
  [5, 4],
  [2, 1],
  [1, 2],
]

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
const decimal = (n: number, digits = 2) =>
  n
    .toFixed(digits)
    .replace(/\.?0+$/, '')
    .replace('.', ',')

export function aspectRatio(width: number, height: number): RatioInfo {
  const value = width / height
  const g = gcd(width, height)
  const rw = width / g
  const rh = height / g
  const common = COMMON_RATIOS.find(([a, c]) => Math.abs(value - a / c) / (a / c) <= 0.01) ?? null
  const label = common && common[0] === rw && common[1] === rh ? `${rw}:${rh}` : common ? `≈ ${common[0]}:${common[1]}` : value >= 1 ? `${decimal(value)}:1` : `1:${decimal(1 / value)}`
  return { value, label, common }
}

/** Square within 1%; panorama / tall from a 2:1 ratio. */
export function orientationOf(width: number, height: number): Orientation {
  const r = width / height
  if (Math.abs(r - 1) <= 0.01) return 'square'
  if (r >= 2) return 'panorama'
  if (r <= 0.5) return 'tall'
  return r > 1 ? 'landscape' : 'portrait'
}

export const ORIENTATION_LABEL: Record<Orientation, string> = {
  square: 'kwadrat',
  landscape: 'pozioma',
  portrait: 'pionowa',
  panorama: 'panorama (bardzo szeroka)',
  tall: 'bardzo wysoka',
}

/** 1 MB = 1 000 000 B (spec 25: the stricter reading never gives a false "pass"). */
export const MB = 1_000_000

export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`
  if (bytes < MB) return `${decimal(bytes / 1000, 1)} kB`
  return `${decimal(bytes / MB, 2)} MB`
}

export function formatMegapixels(mp: number): string {
  return `${decimal(mp, mp < 1 ? 2 : 1)} MP`
}

/**
 * Analyses the first bytes of a file (the header is enough – the browser passes at most a few MB) and its full size.
 * Never throws: a broken or unsupported file comes back with `error`.
 */
export function analyzeBytes(head: Uint8Array, name: string, totalBytes = head.length): ImageAnalysis {
  const base = { name, bytes: totalBytes, pixels: null, megapixels: null, ratio: null, orientation: null }
  if (totalBytes === 0 || head.length === 0) {
    return { ...base, format: 'unknown', width: null, height: null, rotatedByMetadata: false, hasAlphaChannel: null, error: 'Plik jest pusty.' }
  }
  let header: HeaderInfo
  try {
    header = readHeader(head)
  } catch {
    header = { format: sniffFormat(head), width: null, height: null, rotatedByMetadata: false, hasAlphaChannel: null }
  }
  if (header.format === 'unknown') {
    return { ...base, ...header, error: 'To nie jest obsługiwany plik graficzny (rozpoznajemy JPEG, PNG, WebP, HEIC, AVIF, GIF, BMP i TIFF) albo plik jest uszkodzony.' }
  }
  if (!header.width || !header.height) {
    return { ...base, ...header, error: `Nie udało się odczytać wymiarów – plik ${FORMAT_LABEL[header.format]} jest prawdopodobnie uszkodzony lub niepełny.` }
  }
  return {
    ...base,
    ...header,
    megapixels: (header.width * header.height) / 1_000_000,
    ratio: aspectRatio(header.width, header.height),
    orientation: orientationOf(header.width, header.height),
    error: null,
  }
}

/**
 * Background estimate from RGBA pixels (AC-TOOL-002): samples a band at the edge (2% of the shorter side, at least 1 px).
 * It is an estimate – it does not find the product or measure how much of the frame it fills.
 */
export function pixelStats(rgba: ArrayLike<number>, width: number, height: number): PixelStats {
  const band = Math.max(1, Math.round(Math.min(width, height) * 0.02))
  let sampled = 0
  let pure = 0
  let near = 0
  let borderTransparent = 0
  let transparent = 0
  for (let y = 0; y < height; y++) {
    const edgeRow = y < band || y >= height - band
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      const a = rgba[o + 3]
      if (a < 255) transparent++
      if (!edgeRow && x >= band && x < width - band) continue
      sampled++
      const r = rgba[o]
      const g = rgba[o + 1]
      const b = rgba[o + 2]
      if (a < 128) borderTransparent++
      else if (a === 255 && r >= 254 && g >= 254 && b >= 254) pure++
      if (a === 255 && r >= 235 && g >= 235 && b >= 235) near++
    }
  }
  const total = width * height
  const share = (n: number) => (sampled ? n / sampled : 0)
  const border = {
    sampled,
    pureWhiteShare: share(pure),
    nearWhiteShare: share(near),
    transparentShare: share(borderTransparent),
    verdict: 'not-white' as BackgroundVerdict,
  }
  border.verdict = border.transparentShare >= 0.5 ? 'transparent' : border.pureWhiteShare >= 0.98 ? 'white' : border.nearWhiteShare >= 0.9 ? 'light' : 'not-white'
  return { transparentShare: total ? transparent / total : 0, border }
}

export const BACKGROUND_LABEL: Record<BackgroundVerdict, string> = {
  white: 'czysta biel przy krawędziach',
  light: 'jasne, ale nie czysta biel',
  'not-white': 'nie białe',
  transparent: 'przezroczyste',
}
