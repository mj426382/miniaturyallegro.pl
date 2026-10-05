import { APIRequestContext, expect, Page } from '@playwright/test'
import { deflateSync } from 'zlib'

/** The test backend (backend/test/e2e-server.ts) – its in-memory inbox lives outside /api. */
export const BACKEND = process.env.E2E_BACKEND_URL || 'http://localhost:3999'
export const PASSWORD = 'Dobre!Haslo1'

let counter = 0
export function uniqueEmail(prefix: string): string {
  counter++
  return `${prefix}-${Date.now()}-${counter}-${Math.random().toString(36).slice(2, 7)}@e2e.allgrafika.test`
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** A real product-sized PNG (the backend rejects images under 100×100 px). */
export function productPng(size = 400): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // RGB
  const rows: Buffer[] = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3)
    for (let x = 0; x < size; x++) {
      const inside = Math.abs(x - size / 2) < size / 4 && Math.abs(y - size / 2) < size / 4
      row.set(inside ? [220, 40, 40] : [245, 245, 245], 1 + x * 3)
    }
    rows.push(row)
  }
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))])
}

/** Waits for the verification e-mail and returns the link path (/verify-email?token=…). */
export async function verificationLink(request: APIRequestContext, email: string): Promise<string> {
  let link: string | undefined
  await expect
    .poll(
      async () => {
        const res = await request.get(`${BACKEND}/__e2e__/mail?to=${encodeURIComponent(email)}`)
        const mails = (await res.json()) as Array<{ subject: string; text: string }>
        link = mails
          .map((m) => m.text.match(/https?:\/\/[^\s]+\/verify-email\?token=[A-Za-z0-9_-]+/)?.[0])
          .filter(Boolean)
          .at(-1)
        return Boolean(link)
      },
      { timeout: 10_000 },
    )
    .toBe(true)
  const url = new URL(link!)
  return `${url.pathname}${url.search}`
}

export async function register(page: Page, email: string) {
  await page.goto('/register')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Hasło', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Potwierdź hasło').fill(PASSWORD)
  await page.locator('#acceptTerms').check()
  await page.getByRole('button', { name: 'Zarejestruj się' }).click()
  await expect(page.getByRole('heading', { name: /Witaj/ })).toBeVisible()
}

export async function uploadProduct(page: Page) {
  await page.goto('/upload')
  await page.getByLabel('Wybierz zdjęcia z dysku').setInputFiles({ name: 'kubek.png', mimeType: 'image/png', buffer: productPng() })
  await page.getByRole('button', { name: 'Prześlij i wybierz style' }).click()
  await expect(page).toHaveURL(/\/generate\/[a-z0-9-]+$/)
  await expect(page.getByRole('heading', { name: 'Generator grafik produktowych' })).toBeVisible()
}

export async function me(page: Page) {
  // Same as the SPA: the session cookie plus the CSRF header the API requires for cookie auth.
  const res = await page.request.get('/api/users/me', { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
  expect(res.ok()).toBe(true)
  return (await res.json()) as { credits: number; freeCreditsUsed: number; emailVerified: boolean; totalGenerations: number }
}
