/**
 * Spec 20, AC-REF-005: the referral code from /register?ref=<code> survives navigation (e.g. to the
 * login page and back, or a Google sign-up) until the account is created. Kept 30 days on this device.
 */
const KEY = 'allgrafika:ref'
const TTL_MS = 30 * 24 * 60 * 60 * 1000
const CODE = /^[a-z0-9]{4,20}$/i

export function captureReferralFromUrl(search: string = window.location.search): string | null {
  const code = new URLSearchParams(search).get('ref')?.trim().toLowerCase()
  if (code && CODE.test(code)) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }))
    } catch {
      // storage unavailable – the code still works for this page view
    }
    return code
  }
  return storedReferral()
}

export function storedReferral(): string | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const { code, at } = JSON.parse(raw) as { code?: string; at?: number }
    if (!code || !CODE.test(code) || !at || Date.now() - at > TTL_MS) return null
    return code
  } catch {
    return null
  }
}

export function clearReferral() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // nothing to clear
  }
}
