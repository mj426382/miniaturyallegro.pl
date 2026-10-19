/**
 * Spec 25 (AC-TOOL-005): the browser side of the analysis. The file is read with Blob APIs and decoded on a local
 * canvas – nothing is sent anywhere. Pixels are analysed on a copy scaled down to at most 800 px.
 */
import { analyzeBytes, pixelStats, type ImageAnalysis, type PixelStats } from './analyze'

/** The headers we parse sit at the start of the file; a few MB cover EXIF thumbnails and large HEIF meta boxes. */
const HEADER_BYTES = 4 * 1024 * 1024
const MAX_SIDE = 800
/** Larger images are not decoded (memory on phones); the header facts are still shown. */
const MAX_DECODE_MP = 60

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void } | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
    } catch {
      // fall through to <img> (older Safari) – and give up if that fails too
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined }
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function readPixelStats(file: Blob): Promise<PixelStats | null> {
  const decoded = await decode(file)
  if (!decoded || !decoded.width || !decoded.height) return null
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(decoded.width, decoded.height))
    const w = Math.max(1, Math.round(decoded.width * scale))
    const h = Math.max(1, Math.round(decoded.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(decoded.source, 0, 0, w, h)
    return pixelStats(ctx.getImageData(0, 0, w, h).data, w, h)
  } catch {
    return null
  } finally {
    decoded.close()
  }
}

export async function analyzeFile(file: File): Promise<ImageAnalysis> {
  const head = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer())
  const analysis = analyzeBytes(head, file.name, file.size)
  if (analysis.error || (analysis.megapixels ?? 0) > MAX_DECODE_MP) return analysis
  return { ...analysis, pixels: await readPixelStats(file) }
}
