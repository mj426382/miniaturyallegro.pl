/**
 * Cross-platform "save this image" helper.
 *
 * Desktop browsers honour `<a download>` on a blob URL. iOS Safari does not
 * (it opens the image in a tab, or ignores the attribute on older versions),
 * and the most reliable way to land a file in Photos on iPhone or Android is the
 * Web Share API with files. Note: the share sheet needs a *transient user activation*;
 * if the download takes longer than the browser's activation window (~5 s) the call is
 * rejected and we fall back. Strategy, in order:
 *   1. mobile + navigator.share with file support  → share sheet ("Zapisz obraz")
 *   2. `<a download>` with an object URL            → desktop & Android fallback
 *   3. iOS without share support                    → open the blob in a new tab
 */
export type DownloadMethod = 'share' | 'cancelled' | 'share-rejected' | 'anchor' | 'anchor-ios' | 'open-tab'

/** The slice of `window` the helper needs – injectable for tests. */
export interface WindowLike {
  URL: { createObjectURL(blob: Blob): string; revokeObjectURL(url: string): void }
  open(url: string, target?: string): unknown
  setTimeout(fn: () => void, ms: number): unknown
}

export interface DownloadEnv {
  userAgent: string
  /** navigator.maxTouchPoints – iPadOS reports a Mac user agent but has touch points. */
  maxTouchPoints: number
  share?: (data: ShareData) => Promise<void>
  canShare?: (data: ShareData) => boolean
}

export function detectPlatform(env: DownloadEnv): { ios: boolean; android: boolean; mobile: boolean } {
  const ua = env.userAgent
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && env.maxTouchPoints > 1)
  const android = /Android/i.test(ua)
  return { ios, android, mobile: ios || android }
}

function currentEnv(): DownloadEnv {
  const nav = typeof navigator !== 'undefined' ? navigator : ({} as Navigator)
  return {
    userAgent: nav.userAgent || '',
    maxTouchPoints: nav.maxTouchPoints || 0,
    share: typeof nav.share === 'function' ? nav.share.bind(nav) : undefined,
    canShare: typeof nav.canShare === 'function' ? nav.canShare.bind(nav) : undefined,
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+/g, '-').replace(/-+/g, '-')
}

function anchorDownload(blob: Blob, filename: string, doc: Document, win: WindowLike) {
  const url = win.URL.createObjectURL(blob)
  const link = doc.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.style.display = 'none'
  doc.body.appendChild(link)
  link.click()
  doc.body.removeChild(link)
  // Revoke after the click has been processed; immediate revoke breaks Safari and Firefox.
  win.setTimeout(() => win.URL.revokeObjectURL(url), 10_000)
}

/** Opens the native share sheet for an already-downloaded blob. Call it directly from a click handler. */
export async function shareBlob(blob: Blob, filename: string, env: DownloadEnv = currentEnv()): Promise<boolean> {
  if (!env.share) return false
  const file = new File([blob], sanitizeFilename(filename), { type: blob.type || 'image/png' })
  const data: ShareData = { files: [file], title: file.name }
  if (env.canShare && !env.canShare(data)) return false
  try {
    await env.share(data)
    return true
  } catch (err: any) {
    return err?.name === 'AbortError'
  }
}

/**
 * Saves `blob` as `filename`. Returns which method was used (handy for analytics/tests).
 * Never throws for a user-cancelled share sheet.
 */
export async function downloadBlob(
  blob: Blob,
  filename: string,
  env: DownloadEnv = currentEnv(),
  doc: Document = document,
  win: WindowLike = window as unknown as WindowLike,
): Promise<DownloadMethod> {
  const safeName = sanitizeFilename(filename)
  const { ios, mobile } = detectPlatform(env)

  if (mobile && env.share) {
    const file = new File([blob], safeName, { type: blob.type || 'image/png' })
    const data: ShareData = { files: [file], title: safeName }
    const supported = env.canShare ? env.canShare(data) : true
    if (supported) {
      try {
        await env.share(data)
        return 'share'
      } catch (err: any) {
        // AbortError = user closed the sheet → nothing else to do (and nothing to count as a download).
        if (err?.name === 'AbortError') return 'cancelled'
        // NotAllowedError = the user activation expired while we were downloading. The caller
        // can offer a button that calls shareBlob() synchronously from a fresh tap.
        if (err?.name === 'NotAllowedError') return 'share-rejected'
        // Any other failure falls through to the classic methods.
      }
    }
  }

  if (ios) {
    // `download` is unreliable on iOS; a new tab lets the user long-press → "Zapisz obraz".
    const url = win.URL.createObjectURL(blob)
    const opened = win.open(url, '_blank')
    if (opened) {
      win.setTimeout(() => win.URL.revokeObjectURL(url), 60_000)
      return 'open-tab'
    }
  }

  anchorDownload(blob, safeName, doc, win)
  return ios ? 'anchor-ios' : 'anchor'
}
