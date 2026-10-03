/** Part of the source graphic that fills the exported canvas, as fractions (0–1) of its width/height. */
export interface CropRect {
  left: number
  top: number
  width: number
  height: number
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0))
const round4 = (v: number) => Math.round(v * 10000) / 10000

/**
 * Converts the percentage area reported by the crop editor (x/y/width/height in 0–100)
 * into the fractional rectangle the API expects, clamped so it never leaves the image.
 */
export function toCropRect(areaPercent: { x: number; y: number; width: number; height: number }): CropRect {
  const width = clamp01(areaPercent.width / 100)
  const height = clamp01(areaPercent.height / 100)
  const left = clamp01(Math.min(areaPercent.x / 100, 1 - width))
  const top = clamp01(Math.min(areaPercent.y / 100, 1 - height))
  return { left: round4(left), top: round4(top), width: round4(width), height: round4(height) }
}

/** True when the rectangle covers the whole graphic – exporting it equals exporting without a crop. */
export function isFullFrame(crop: CropRect): boolean {
  return crop.left === 0 && crop.top === 0 && crop.width === 1 && crop.height === 1
}

/** Numeric aspect for an "w:h" ratio string such as "4:3". */
export function ratioToAspect(ratio: string): number {
  const [w, h] = ratio.split(':').map(Number)
  return w > 0 && h > 0 ? w / h : 1
}
