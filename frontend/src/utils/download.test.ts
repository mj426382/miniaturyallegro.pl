import { describe, it, expect, vi, beforeEach } from 'vitest'
import { detectPlatform, downloadBlob, shareBlob, DownloadEnv, WindowLike } from './download'

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
  windowsChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  firefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
}

function fakeWindow() {
  const anchors: HTMLAnchorElement[] = []
  const doc = document
  const originalCreate = doc.createElement.bind(doc)
  const createSpy = vi.spyOn(doc, 'createElement').mockImplementation((tag: string) => {
    const el = originalCreate(tag)
    if (tag === 'a') {
      vi.spyOn(el as HTMLAnchorElement, 'click').mockImplementation(() => undefined)
      anchors.push(el as HTMLAnchorElement)
    }
    return el
  })
  const win = {
    URL: { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() },
    open: vi.fn(() => ({})),
    setTimeout: vi.fn(),
  } as unknown as WindowLike
  return { win, anchors, restore: () => createSpy.mockRestore() }
}

const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })

describe('detectPlatform', () => {
  it('recognises iPhone, iPad (desktop UA + touch), Android and desktop', () => {
    expect(detectPlatform({ userAgent: UA.iphone, maxTouchPoints: 5 })).toEqual({ ios: true, android: false, mobile: true })
    expect(detectPlatform({ userAgent: UA.ipad, maxTouchPoints: 5 })).toEqual({ ios: true, android: false, mobile: true })
    expect(detectPlatform({ userAgent: UA.macSafari, maxTouchPoints: 0 })).toEqual({ ios: false, android: false, mobile: false })
    expect(detectPlatform({ userAgent: UA.android, maxTouchPoints: 5 })).toEqual({ ios: false, android: true, mobile: true })
    expect(detectPlatform({ userAgent: UA.windowsChrome, maxTouchPoints: 0 })).toEqual({ ios: false, android: false, mobile: false })
  })
})

describe('downloadBlob', () => {
  let ctx: ReturnType<typeof fakeWindow>
  beforeEach(() => {
    ctx = fakeWindow()
  })

  it('[AC-EXP-015] uses the share sheet on iPhone when files can be shared', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const canShare = vi.fn().mockReturnValue(true)
    const env: DownloadEnv = { userAgent: UA.iphone, maxTouchPoints: 5, share, canShare }

    const method = await downloadBlob(blob, 'grafika white-bg.png', env, document, ctx.win)

    expect(method).toBe('share')
    const data = share.mock.calls[0][0]
    expect(data.files[0]).toBeInstanceOf(File)
    expect(data.files[0].name).toBe('grafika-white-bg.png')
    expect(data.files[0].type).toBe('image/png')
    expect(ctx.anchors).toHaveLength(0)
    ctx.restore()
  })

  it('[AC-EXP-016] treats a cancelled share sheet as handled (no fallback popup)', async () => {
    const share = vi.fn().mockRejectedValue(Object.assign(new Error('cancel'), { name: 'AbortError' }))
    const env: DownloadEnv = { userAgent: UA.android, maxTouchPoints: 5, share, canShare: () => true }
    expect(await downloadBlob(blob, 'a.png', env, document, ctx.win)).toBe('cancelled')
    expect(ctx.anchors).toHaveLength(0)
    expect(ctx.win.open).not.toHaveBeenCalled()
    ctx.restore()
  })

  it('[AC-EXP-017] falls back to a new tab on iOS when sharing files is unsupported', async () => {
    const env: DownloadEnv = { userAgent: UA.iphone, maxTouchPoints: 5, share: vi.fn(), canShare: () => false }
    expect(await downloadBlob(blob, 'a.png', env, document, ctx.win)).toBe('open-tab')
    expect(ctx.win.open).toHaveBeenCalledWith('blob:fake', '_blank')
    ctx.restore()
  })

  it('[AC-EXP-018] falls back to the anchor download on iOS when the popup is blocked', async () => {
    ;(ctx.win.open as any).mockReturnValue(null)
    const env: DownloadEnv = { userAgent: UA.iphone, maxTouchPoints: 5 }
    expect(await downloadBlob(blob, 'a.png', env, document, ctx.win)).toBe('anchor-ios')
    expect(ctx.anchors[0].download).toBe('a.png')
    ctx.restore()
  })

  it('uses the share sheet on Android Chrome and the anchor when share fails for another reason', async () => {
    const env: DownloadEnv = { userAgent: UA.android, maxTouchPoints: 5, share: vi.fn().mockResolvedValue(undefined), canShare: () => true }
    expect(await downloadBlob(blob, 'a.png', env, document, ctx.win)).toBe('share')

    const failing: DownloadEnv = { userAgent: UA.android, maxTouchPoints: 5, share: vi.fn().mockRejectedValue(new Error('weird')), canShare: () => true }
    expect(await downloadBlob(blob, 'b.png', failing, document, ctx.win)).toBe('anchor')
    expect(ctx.anchors[0].download).toBe('b.png')
    expect(ctx.anchors[0].click).toHaveBeenCalled()
    ctx.restore()
  })

  it('[AC-EXP-019] reports an expired user activation so the UI can ask for one more tap, and shareBlob then succeeds', async () => {
    const expired = Object.assign(new Error('no activation'), { name: 'NotAllowedError' })
    const share = vi.fn().mockRejectedValueOnce(expired).mockResolvedValueOnce(undefined)
    const env: DownloadEnv = { userAgent: UA.iphone, maxTouchPoints: 5, share, canShare: () => true }
    expect(await downloadBlob(blob, 'a.png', env, document, ctx.win)).toBe('share-rejected')
    expect(ctx.anchors).toHaveLength(0)
    expect(await shareBlob(blob, 'a.png', env)).toBe(true)
    expect(share).toHaveBeenCalledTimes(2)
    ctx.restore()
  })

  it.each([
    ['Windows Chrome', UA.windowsChrome],
    ['macOS Safari', UA.macSafari],
    ['Linux Firefox', UA.firefox],
  ])('uses a plain <a download> on desktop (%s) even if navigator.share exists', async (_name, userAgent) => {
    const share = vi.fn()
    const env: DownloadEnv = { userAgent, maxTouchPoints: 0, share, canShare: () => true }
    expect(await downloadBlob(blob, 'grafika-white-bg.png', env, document, ctx.win)).toBe('anchor')
    expect(share).not.toHaveBeenCalled()
    expect(ctx.anchors).toHaveLength(1)
    expect(ctx.anchors[0].href).toContain('blob:fake')
    expect(ctx.anchors[0].download).toBe('grafika-white-bg.png')
    expect(ctx.anchors[0].click).toHaveBeenCalledTimes(1)
    // the object URL is revoked later, not immediately (Safari/Firefox need the URL alive during the click)
    expect(ctx.win.URL.revokeObjectURL).not.toHaveBeenCalled()
    expect(ctx.win.setTimeout).toHaveBeenCalled()
    ctx.restore()
  })
})
