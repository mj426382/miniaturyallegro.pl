import { Page } from '@playwright/test'
// Spec 08: the mock serves the real presets – one source of truth shared with the API.
import { listPlatformPresets, PLATFORM_PRESETS, PlatformId } from '../../backend/src/generation/platform-presets'

export const PLATFORM_PRESET_LIST = listPlatformPresets()

/** 1×1 PNG – enough for the browser to treat the download as an image. */
export const PNG_BYTES = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

export const USER = {
  id: 'user-1',
  email: 'test@allgrafika.pl',
  name: 'Test',
  credits: 5,
  freeCreditsUsed: 3,
  totalGenerations: 1,
  _count: { images: 1 },
  createdAt: '2026-10-01T00:00:00.000Z',
  emailVerified: true,
}

export const IMAGE = {
  id: 'img-1',
  filename: 'originals/img-1.jpg',
  originalUrl: '/api/uploads/originals/img-1.jpg',
  createdAt: '2026-10-01T00:00:00.000Z',
  generations: [
    { id: 'gen-1', style: 'white-bg', status: 'COMPLETED', url: '/api/uploads/generated/gen-1.png', rating: null, createdAt: '2026-10-01T00:00:00.000Z' },
    { id: 'gen-2', style: 'dark-luxury', status: 'FAILED', url: null, rating: null, createdAt: '2026-10-01T00:00:00.000Z' },
  ],
}

export const STYLES = {
  styles: [
    { id: 'white-bg', name: 'Białe tło', description: 'Czyste białe tło', starter: true, category: 'universal', inSeason: false },
    { id: 'lifestyle-home', name: 'Lifestyle – wnętrze', description: 'Wnętrze', starter: true, category: 'universal', inSeason: false },
    { id: 'dark-luxury', name: 'Ciemny luksus', description: 'Ciemne tło', starter: true, category: 'universal', inSeason: false },
    { id: 'gradient-bg', name: 'Gradient', description: 'Gradient', starter: false, category: 'universal', inSeason: false },
    { id: 'valentines', name: 'Walentynki', description: 'Róż i czerwień', starter: false, category: 'seasonal', inSeason: false },
    { id: 'christmas', name: 'Boże Narodzenie', description: 'Świąteczny klimat', starter: false, category: 'seasonal', inSeason: true },
    { id: 'fashion', name: 'Moda i odzież', description: 'Flat lay', starter: false, category: 'industry', inSeason: false },
  ],
  defaultStyleIds: ['white-bg', 'lifestyle-home', 'dark-luxury'],
}

/**
 * Logs the user in (token in localStorage) and mocks every API route the
 * generation page touches. Download/export endpoints record their requests.
 */
export const DESCRIPTION = {
  title: 'Kubek ceramiczny 350 ml biały do zmywarki',
  body: '<p>Solidny kubek na co dzień.</p><h2>Najważniejsze cechy</h2><ul><li>pojemność 350 ml</li><li>można myć w zmywarce</li></ul>',
  keywords: ['kubek ceramiczny', 'kubek 350 ml'],
  sellerNotes: 'kubek 350 ml',
  platform: 'generic' as PlatformId,
  titleMaxLength: 75,
  promptEditsUsed: 0,
  updatedAt: '2026-10-02T00:00:00.000Z',
}

export const PASSWORD = 'Dobre!Haslo1'

/** Spec 16: rows of the admin user list. */
export const ADMIN_USERS = [
  {
    id: 'u-shop',
    email: 'sklep.kubki@example.com',
    name: 'Ania',
    createdAt: '2026-10-02T09:00:00.000Z',
    emailVerified: true,
    provider: 'google+password',
    images: 4,
    completedGenerations: 12,
    failedGenerations: 1,
    lastActivityAt: '2026-10-04T12:00:00.000Z',
    credits: 7,
    freeCreditsLeft: 0,
    plan: { planId: 'sub_start', name: 'Start', status: 'active' },
    paidTotalGrosze: 2800,
    marketingConsent: true,
  },
  {
    id: 'u-new',
    email: 'nowy@example.com',
    name: null,
    createdAt: '2026-10-05T08:00:00.000Z',
    emailVerified: false,
    provider: 'password',
    images: 0,
    completedGenerations: 0,
    failedGenerations: 0,
    lastActivityAt: null,
    credits: 0,
    freeCreditsLeft: 10,
    plan: null,
    paidTotalGrosze: 0,
    marketingConsent: false,
  },
]

export interface MockOptions {
  loggedIn?: boolean
  /** Spec 13 – unconfirmed account (banner, gate). */
  emailVerified?: boolean
  /** Pre-existing offer copy for IMAGE. */
  withDescription?: boolean
  /** Payment history rows. */
  history?: any[]
  /** Extra gallery photos (spec 15). */
  extraImages?: any[]
  /** Spec 16: the account is listed in ADMIN_EMAILS. */
  isAdmin?: boolean
  /** Free pool used up and no paid credits. */
  noCredits?: boolean
  /** Spec 19: the account has a paid transaction, so no welcome pack is offered. */
  hasPurchased?: boolean
  /** Spec 19: free pool of the account (default 10, accounts from 2026-10-09: 5). */
  freeCreditsLimit?: number
  /** The existing offer copy has used all of its free AI rewrites. */
  editsUsedUp?: boolean
  /** Spec 19: the user already said yes or no to marketing e-mails. */
  marketingConsent?: boolean
  /** Spec 27: saved user styles at page load (newest first). */
  userStyles?: any[]
}

export async function mockApp(page: Page, options: MockOptions = {}) {
  const requests: Array<{ url: string; method: string; body?: any }> = []
  let loggedIn = options.loggedIn ?? true
  let emailVerified = options.emailVerified ?? true
  const settings = { marketingConsent: false, notifyBatchDone: true }
  const images: any[] = [IMAGE, ...(options.extraImages ?? [])]
  // Offer description state lives for the duration of the page – mirrors the API behaviour.
  let description: typeof DESCRIPTION | null = options.withDescription ? { ...DESCRIPTION, promptEditsUsed: options.editsUsedUp ? 5 : 0 } : null
  let editsPurchased = 0
  const descriptionView = () => ({
    description,
    promptEditsLimit: 5 + editsPurchased,
    promptEditsLeft: 5 + editsPurchased - (description?.promptEditsUsed ?? 0),
    canCreate: true,
    creditCost: 0,
    editPackSize: 15,
    editPackCredits: 1,
  })
  let uploadCounter = 0
  // Spec 27: saved user styles (newest first), multipart fields parsed from the raw body.
  const userStyles: any[] = [...(options.userStyles ?? [])]
  let userStyleCounter = 0
  const userStyleGenerations: any[] = []
  const formField = (raw: string | null, name: string) => raw?.match(new RegExp(`name="${name}"\\r\\n\\r\\n([\\s\\S]*?)\\r\\n--`))?.[1]
  const hasFile = (raw: string | null) => Boolean(raw && /name="reference"; filename=/.test(raw))
  const adminEmails: any[] = []
  const adminGrants: any[] = []
  // Spec 16, AC-ADM-017/018: discount codes of the admin panel (newest first).
  const discountCodes: any[] = [
    {
      id: 'dc-1',
      code: 'KATALOG-10',
      type: 'percent',
      percentOff: 10,
      amountOffGrosze: null,
      maxRedemptions: 50,
      expiresAt: '2026-12-31T22:59:59.000Z',
      note: 'Katalog firm – czytelnicy',
      status: 'active',
      timesRedeemed: 3,
      orders: 2,
      createdBy: USER.email,
      createdAt: '2026-10-10T10:00:00.000Z',
      deactivatedAt: null,
      partner: { id: 'p-1', name: 'Katalog Firm' },
    },
    // Spec 24: an older code without a partner (linked from the partner details)
    {
      id: 'dc-0',
      code: 'SMARTNET20',
      type: 'percent',
      percentOff: 20,
      amountOffGrosze: null,
      maxRedemptions: null,
      expiresAt: null,
      note: null,
      status: 'active',
      timesRedeemed: 1,
      orders: 1,
      createdBy: USER.email,
      createdAt: '2026-10-01T10:00:00.000Z',
      deactivatedAt: null,
      partner: null,
    },
  ]
  // Spec 24, AC-PRT-013/015: partners, their monthly statements (masked customers) and payouts.
  const partnerCode = (c: any) => ({
    id: c.id,
    code: c.code,
    type: c.type,
    percentOff: c.percentOff,
    amountOffGrosze: c.amountOffGrosze,
    expiresAt: c.expiresAt,
    status: c.status === 'inactive' ? 'inactive' : 'active',
  })
  const partners: any[] = [
    {
      id: 'p-1',
      name: 'Katalog Firm',
      contactEmail: 'partner@example.com',
      companyName: 'Katalog Firm sp. z o.o.',
      nip: '5260001246',
      customerDiscountPercent: 10,
      commissionPercent: 20,
      commissionMonths: 12,
      active: true,
      note: null,
      createdBy: USER.email,
      createdAt: '2026-09-01T10:00:00.000Z',
      updatedAt: '2026-09-01T10:00:00.000Z',
      codes: [partnerCode(discountCodes[0])],
      customers: 3,
      currentMonth: { orders: 2, netPaidGrosze: 3520, commissionGrosze: 704 },
      allTime: { orders: 3, netPaidGrosze: 6040, commissionGrosze: 1208 },
      paidOutGrosze: 500,
      balanceGrosze: 708,
    },
  ]
  const partnerMonths: Record<string, any[]> = {
    'p-1': [
      {
        month: '2026-10',
        orders: 2,
        netPaidGrosze: 3520,
        commissionGrosze: 704,
        entries: [
          {
            id: 'e-4',
            occurredAt: '2026-10-12T10:00:00.000Z',
            kind: 'payment',
            product: 'Pakiet 15 kredytów',
            customer: 'K-1a2b3c4d',
            netPaidGrosze: 2520,
            commissionGrosze: 504,
            commissionPercent: 20,
          },
          { id: 'e-3', occurredAt: '2026-10-03T10:00:00.000Z', kind: 'payment', product: 'Abonament', customer: 'K-9f8e7d6c', netPaidGrosze: 1000, commissionGrosze: 200, commissionPercent: 20 },
        ],
      },
      {
        month: '2026-09',
        orders: 1,
        netPaidGrosze: 2520,
        commissionGrosze: 504,
        entries: [
          {
            id: 'e-2',
            occurredAt: '2026-09-20T10:00:00.000Z',
            kind: 'adjustment',
            product: 'Pakiet 15 kredytów',
            customer: 'K-5e5e5e5e',
            netPaidGrosze: -280,
            commissionGrosze: -56,
            commissionPercent: 20,
          },
          {
            id: 'e-1',
            occurredAt: '2026-09-02T10:00:00.000Z',
            kind: 'payment',
            product: 'Pakiet 15 kredytów',
            customer: 'K-5e5e5e5e',
            netPaidGrosze: 2800,
            commissionGrosze: 560,
            commissionPercent: 20,
          },
        ],
      },
    ],
  }
  const partnerPayouts: Record<string, any[]> = {
    'p-1': [{ id: 'po-1', amountGrosze: 500, paidOn: '2026-10-05', reference: 'FV 1/10/2026', createdBy: USER.email, createdAt: '2026-10-05T10:00:00.000Z' }],
  }
  const partnerDetail = (p: any) => ({ ...p, month: '2026-10', minPayoutGrosze: 5000, months: partnerMonths[p.id] ?? [], payouts: partnerPayouts[p.id] ?? [] })

  // Session is an httpOnly cookie – the SPA simply asks /users/me, which we answer as logged in.

  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname.replace(/^\/api/, '')
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

    if (path === '/users/me' && req.method() === 'GET')
      return loggedIn
        ? json({
            ...USER,
            hasPassword: true,
            emailVerified,
            ...settings,
            freeCreditsLimit: options.freeCreditsLimit ?? 10,
            ...(options.marketingConsent !== undefined ? { marketingConsent: options.marketingConsent } : {}),
            ...(options.noCredits ? { credits: 0, freeCreditsUsed: options.freeCreditsLimit ?? 10 } : {}),
            isAdmin: Boolean(options.isAdmin),
            unlimitedCredits: Boolean(options.isAdmin),
          })
        : json({ message: 'Unauthorized' }, 401)
    if (path === '/users/me/referral') return json({ code: 'abc23xyz', link: 'http://localhost:4173/register?ref=abc23xyz', bonus: 3, maxRewards: 25, referred: 2, rewarded: 1, creditsEarned: 3 })
    if (path === '/notifications/batches') {
      requests.push({ url: path, method: 'POST', body: req.postDataJSON() })
      return json({ id: 'batch-1' }, 201)
    }
    if (path === '/notifications/unsubscribe') {
      requests.push({ url: `${path}?${url.searchParams.toString()}`, method: 'POST' })
      if (url.searchParams.get('token') !== 'unsub-token') return json({ statusCode: 400, message: 'Link wypisania jest nieprawidłowy' }, 400)
      settings.marketingConsent = false
      return json({ unsubscribed: true })
    }
    if (path.startsWith('/admin/') && !options.isAdmin) return json({ statusCode: 403, message: 'Dostęp tylko dla administratora' }, 403)
    if (path === '/admin/overview')
      return json({
        users: { total: 2, last30d: 1 },
        generations: { COMPLETED: 12 },
        staleGenerations: 0,
        revenue: { completedTransactions: 1, totalGrosze: 2800, last30dGrosze: 2800, creditsSold: 15 },
        subscriptions: { active: 1 },
        demo: { leads: 4, last30d: 2 },
        ratedGenerations: 3,
      })
    if (path === '/admin/users') {
      requests.push({ url: `${path}?${url.searchParams.toString()}`, method: 'GET' })
      const search = (url.searchParams.get('search') || '').toLowerCase()
      const rows = ADMIN_USERS.filter((u) => !search || u.email.includes(search))
      return json({ users: rows, pagination: { page: 1, limit: 20, total: rows.length, pages: 1 } })
    }
    if (/^\/admin\/users\/[^/]+\/images$/.test(path)) {
      requests.push({ url: path, method: 'GET' })
      return json({
        images: [
          {
            id: 'img-a',
            originalUrl: '/api/uploads/originals/a.jpg',
            createdAt: '2026-10-04T10:00:00.000Z',
            descriptionTitle: 'Kubek ceramiczny 350 ml',
            generations: [
              { id: 'g-a1', style: 'white-bg', status: 'COMPLETED', url: '/api/uploads/generated/a1.png', rating: -1, ratingReason: 'artifacts', createdAt: '2026-10-04T10:01:00.000Z' },
              { id: 'g-a2', style: 'dark-luxury', status: 'FAILED', url: null, rating: null, ratingReason: null, createdAt: '2026-10-04T10:01:00.000Z' },
            ],
          },
        ],
        pagination: { page: 1, limit: 12, total: 1, pages: 1 },
      })
    }
    if (path === '/admin/generations') {
      requests.push({ url: `${path}?${url.searchParams.toString()}`, method: 'GET' })
      const all = [
        {
          id: 'g-a1',
          style: 'white-bg',
          status: 'COMPLETED',
          url: '/api/uploads/generated/a1.png',
          rating: -1,
          ratingReason: 'other: zły kolor',
          createdAt: '2026-10-04T10:01:00.000Z',
          image: { id: 'img-a', originalUrl: '/api/uploads/originals/a.jpg' },
          user: { id: 'u-shop', email: 'sklep.kubki@example.com' },
        },
        {
          id: 'g-b1',
          style: 'gradient-bg',
          status: 'COMPLETED',
          url: '/api/uploads/generated/b1.png',
          rating: null,
          ratingReason: null,
          createdAt: '2026-10-04T09:00:00.000Z',
          image: { id: 'img-b', originalUrl: '/api/uploads/originals/b.jpg' },
          user: { id: 'u-new', email: 'nowy@example.com' },
        },
      ]
      const rating = url.searchParams.get('rating')
      const rows = rating === 'down' ? all.filter((g) => g.rating === -1) : all
      return json({ generations: rows, pagination: { page: 1, limit: 24, total: rows.length, pages: 1 } })
    }
    if (/^\/admin\/users\/[^/]+$/.test(path)) {
      const row = ADMIN_USERS.find((u) => path.endsWith(u.id))
      return row
        ? json({
            ...row,
            subscription: null,
            payments: [
              {
                id: 'tx-2',
                amountPln: 2520,
                creditsAdded: 15,
                status: 'completed',
                kind: 'package',
                createdAt: '2026-10-12T10:00:00.000Z',
                hasInvoice: true,
                amountDiscount: 280,
                promotionCode: 'PARTNER-10',
              },
              { id: 'tx-1', amountPln: 2800, creditsAdded: 15, status: 'completed', kind: 'package', createdAt: '2026-10-03T10:00:00.000Z', hasInvoice: true, amountDiscount: 0, promotionCode: null },
            ],
            emails: adminEmails,
            creditGrants: adminGrants,
          })
        : json({ message: 'Nie znaleziono' }, 404)
    }
    if (path === '/admin/discount-codes' && req.method() === 'GET') return json({ codes: discountCodes })
    if (path === '/admin/discount-codes' && req.method() === 'POST') {
      const body = req.postDataJSON()
      requests.push({ url: path, method: 'POST', body })
      if (discountCodes.some((c) => c.code === body.code)) return json({ statusCode: 409, message: 'Taki kod już istnieje – wybierz inny' }, 409)
      const created = {
        id: `dc-${discountCodes.length + 1}`,
        code: body.code,
        type: body.type,
        percentOff: body.percentOff ?? null,
        amountOffGrosze: body.amountOffPln ? Math.round(body.amountOffPln * 100) : null,
        maxRedemptions: body.maxRedemptions ?? null,
        expiresAt: body.expiresAt ?? null,
        note: body.note ?? null,
        status: 'active',
        timesRedeemed: 0,
        orders: 0,
        createdBy: USER.email,
        createdAt: '2026-10-18T10:00:00.000Z',
        deactivatedAt: null,
      }
      discountCodes.unshift(created)
      return json(created, 201)
    }
    if (/^\/admin\/discount-codes\/[^/]+\/deactivate$/.test(path)) {
      requests.push({ url: path, method: 'POST' })
      const code = discountCodes.find((c) => path.includes(`/${c.id}/`))
      if (!code) return json({ statusCode: 404, message: 'Nie znaleziono kodu rabatowego' }, 404)
      Object.assign(code, { status: 'inactive', deactivatedAt: '2026-10-18T11:00:00.000Z' })
      return json(code)
    }
    if (path === '/admin/partners' && req.method() === 'GET') return json({ month: '2026-10', minPayoutGrosze: 5000, partners })
    if (path === '/admin/partners' && req.method() === 'POST') {
      const body = req.postDataJSON()
      requests.push({ url: path, method: 'POST', body })
      if (body.code && discountCodes.some((c) => c.code === body.code)) return json({ statusCode: 409, message: 'Taki kod już istnieje – wybierz inny' }, 409)
      const id = `p-${partners.length + 1}`
      const codes: any[] = []
      if (body.code) {
        const code = {
          ...discountCodes[1],
          id: `dc-${discountCodes.length + 1}`,
          code: body.code,
          percentOff: body.customerDiscountPercent,
          partner: { id, name: body.name },
          orders: 0,
          timesRedeemed: 0,
        }
        discountCodes.unshift(code)
        codes.push(partnerCode(code))
      }
      const zero = { orders: 0, netPaidGrosze: 0, commissionGrosze: 0 }
      const created = {
        companyName: null,
        nip: null,
        note: null,
        ...body,
        id,
        codes,
        customers: 0,
        currentMonth: zero,
        allTime: zero,
        paidOutGrosze: 0,
        balanceGrosze: 0,
        createdBy: USER.email,
        createdAt: '2026-10-19T10:00:00.000Z',
        updatedAt: '2026-10-19T10:00:00.000Z',
      }
      delete created.code
      partners.unshift(created)
      return json(created, 201)
    }
    const partnerPath = /^\/admin\/partners\/([^/]+)(?:\/(codes\/link|codes|payouts|codes\/([^/]+)\/unlink))?$/.exec(path)
    if (partnerPath) {
      const p = partners.find((x) => x.id === partnerPath[1])
      if (!p) return json({ statusCode: 404, message: 'Nie znaleziono partnera' }, 404)
      const action = partnerPath[2]
      const body = req.method() === 'GET' ? undefined : req.postDataJSON()
      if (req.method() !== 'GET') requests.push({ url: path, method: req.method(), body })
      if (!action && req.method() === 'GET') return json(partnerDetail(p))
      if (!action && req.method() === 'PATCH') {
        Object.assign(p, body)
        return json(p)
      }
      if (action === 'codes/link') {
        const code = discountCodes.find((c) => c.code === body.code)
        if (!code) return json({ statusCode: 404, message: 'Nie znaleziono kodu rabatowego – najpierw utwórz go w zakładce „Kody rabatowe”' }, 404)
        if (code.partner && code.partner.id !== p.id) return json({ statusCode: 409, message: 'Ten kod jest już podłączony do innego partnera' }, 409)
        code.partner = { id: p.id, name: p.name }
        if (!p.codes.some((c: any) => c.id === code.id)) p.codes.unshift(partnerCode(code))
        return json(p)
      }
      if (action === 'codes') {
        if (discountCodes.some((c) => c.code === body.code)) return json({ statusCode: 409, message: 'Taki kod już istnieje – wybierz inny' }, 409)
        const code = { ...discountCodes[0], id: `dc-${discountCodes.length + 1}`, code: body.code, percentOff: p.customerDiscountPercent, partner: { id: p.id, name: p.name } }
        discountCodes.unshift(code)
        p.codes.unshift(partnerCode(code))
        return json(p, 201)
      }
      if (action?.endsWith('/unlink')) {
        p.codes = p.codes.filter((c: any) => c.id !== partnerPath[3])
        const code = discountCodes.find((c) => c.id === partnerPath[3])
        if (code) code.partner = null
        return json(p)
      }
      if (action === 'payouts') {
        const amountGrosze = Math.round(body.amountPln * 100)
        const warnings = [...(amountGrosze < 5000 ? ['Kwota jest poniżej progu wypłaty 50,00 zł.'] : []), ...(amountGrosze > p.balanceGrosze ? ['Wypłata jest wyższa niż saldo do wypłaty.'] : [])]
        const payout = {
          id: `po-${(partnerPayouts[p.id]?.length ?? 0) + 1}`,
          amountGrosze,
          paidOn: body.paidOn,
          reference: body.reference,
          createdBy: USER.email,
          createdAt: '2026-10-19T10:00:00.000Z',
        }
        partnerPayouts[p.id] = [payout, ...(partnerPayouts[p.id] ?? [])]
        p.paidOutGrosze += amountGrosze
        p.balanceGrosze -= amountGrosze
        return json({ payout, balanceGrosze: p.balanceGrosze, warnings }, 201)
      }
    }
    if (/^\/admin\/users\/[^/]+\/credits$/.test(path)) {
      const body = req.postDataJSON()
      requests.push({ url: path, method: 'POST', body })
      const grant = { id: `g-${adminGrants.length + 1}`, amount: body.amount, reason: body.reason, grantedBy: USER.email, createdAt: '2026-10-09T10:00:00.000Z' }
      adminGrants.unshift(grant)
      return json({ credits: body.amount, grant }, 201)
    }
    if (/^\/admin\/users\/[^/]+\/email$/.test(path)) {
      const body = req.postDataJSON()
      requests.push({ url: path, method: 'POST', body })
      const entry = { id: `m-${adminEmails.length + 1}`, kind: 'admin', subject: body.subject, body: body.message, sentBy: USER.email, createdAt: '2026-10-05T10:00:00.000Z' }
      adminEmails.unshift(entry)
      return json(entry, 201)
    }
    if (path === '/auth/resend-verification') {
      requests.push({ url: path, method: 'POST' })
      return json({ sent: true })
    }
    if (path === '/auth/verify-email') {
      const body = req.postDataJSON()
      requests.push({ url: path, method: 'POST', body })
      if (body?.token !== 'good-token') return json({ statusCode: 400, message: 'Link weryfikacyjny jest nieprawidłowy lub wygasł' }, 400)
      emailVerified = true
      return json({ verified: true })
    }
    if (path === '/generation/infographic-icons')
      return json([
        { id: 'check', name: 'Zaleta' },
        { id: 'shield', name: 'Gwarancja' },
        { id: 'truck', name: 'Dostawa' },
      ])
    if (path === '/generation/infographic/gen-1') {
      requests.push({ url: path, method: 'POST', body: req.postDataJSON() })
      return route.fulfill({ status: 201, contentType: 'image/png', headers: { 'Content-Disposition': 'attachment; filename="infografika-features-white-bg.png"' }, body: PNG_BYTES })
    }
    if (path === '/generation/zip') {
      requests.push({ url: path, method: 'POST', body: req.postDataJSON() })
      return route.fulfill({
        status: 201,
        contentType: 'application/zip',
        headers: { 'Content-Disposition': 'attachment; filename="allgrafika-2026-10-04.zip"' },
        body: Buffer.from('PK\u0005\u0006' + '\u0000'.repeat(18), 'binary'),
      })
    }
    if (/^\/payments\/invoices\//.test(path)) {
      requests.push({ url: path, method: 'GET' })
      return json({ url: 'about:blank#invoice' })
    }
    if (path === '/generation/platform-presets') {
      requests.push({ url: path, method: 'GET' })
      return json(PLATFORM_PRESET_LIST)
    }
    if (path === '/users/me' && req.method() === 'PATCH') {
      const body = req.postDataJSON()
      requests.push({ url: path, method: 'PATCH', body })
      if (typeof body?.marketingConsent === 'boolean') settings.marketingConsent = body.marketingConsent
      if (typeof body?.notifyBatchDone === 'boolean') settings.notifyBatchDone = body.notifyBatchDone
      return json({ ...USER, hasPassword: true, ...settings, name: body?.name ?? USER.name })
    }
    if (path === '/users/me' && req.method() === 'DELETE') {
      requests.push({ url: path, method: 'DELETE', body: req.postDataJSON() })
      loggedIn = false
      return json({ message: 'Konto zostało usunięte' })
    }
    if (path === '/auth/login') {
      const body = req.postDataJSON()
      requests.push({ url: path, method: 'POST', body })
      if (body?.password !== PASSWORD) return json({ message: 'Nieprawidłowy e-mail lub hasło' }, 401)
      loggedIn = true
      return json({ user: USER, token: 'cookie' }, 201)
    }
    if (path === '/auth/register') {
      requests.push({ url: path, method: 'POST', body: req.postDataJSON() })
      loggedIn = true
      return json({ user: USER, token: 'cookie' }, 201)
    }
    if (path === '/auth/forgot-password') {
      requests.push({ url: path, method: 'POST', body: req.postDataJSON() })
      return json({ message: 'ok' })
    }
    if (path === '/auth/change-password') {
      const body = req.postDataJSON()
      requests.push({ url: path, method: 'POST', body })
      if (body?.currentPassword !== PASSWORD) return json({ message: 'Obecne hasło jest nieprawidłowe' }, 400)
      return json({ message: 'Hasło zostało zmienione.', token: 'cookie' }, 201)
    }
    if (path === '/auth/logout') {
      requests.push({ url: path, method: 'POST' })
      loggedIn = false
      return json({ ok: true })
    }
    if (path === '/user-styles' && req.method() === 'GET') return json(userStyles)
    if (path === '/user-styles' && req.method() === 'POST') {
      const raw = req.postData()
      const name = formField(raw, 'name')?.trim() ?? ''
      const prompt = formField(raw, 'prompt')?.trim() ?? ''
      requests.push({ url: path, method: 'POST', body: { name, prompt, reference: hasFile(raw) } })
      if (userStyles.some((s) => s.name.toLowerCase() === name.toLowerCase())) return json({ message: 'Masz już styl o tej nazwie.' }, 409)
      const style = {
        id: `us-${++userStyleCounter}`,
        name,
        prompt,
        referenceUrl: hasFile(raw) ? '/api/uploads/user-styles/ref.png' : null,
        createdAt: '2026-10-28T10:00:00.000Z',
        updatedAt: '2026-10-28T10:00:00.000Z',
      }
      userStyles.unshift(style)
      return json(style, 201)
    }
    if (/^\/user-styles\/[\w-]+$/.test(path) && (req.method() === 'PATCH' || req.method() === 'DELETE')) {
      const id = path.split('/').pop()!
      const i = userStyles.findIndex((s) => s.id === id)
      if (i < 0) return json({ message: 'Nie znaleziono stylu' }, 404)
      if (req.method() === 'DELETE') {
        requests.push({ url: path, method: 'DELETE' })
        userStyles.splice(i, 1)
        return json({ ok: true })
      }
      const raw = req.postData()
      const name = formField(raw, 'name')?.trim()
      const prompt = formField(raw, 'prompt')?.trim()
      const removeReference = formField(raw, 'removeReference') === 'true'
      requests.push({ url: path, method: 'PATCH', body: { name, prompt, removeReference, reference: hasFile(raw) } })
      if (name && userStyles.some((s, j) => j !== i && s.name.toLowerCase() === name.toLowerCase())) return json({ message: 'Masz już styl o tej nazwie.' }, 409)
      userStyles[i] = {
        ...userStyles[i],
        ...(name ? { name } : {}),
        ...(prompt ? { prompt } : {}),
        referenceUrl: hasFile(raw) ? '/api/uploads/user-styles/new.png' : removeReference ? null : userStyles[i].referenceUrl,
      }
      return json(userStyles[i])
    }
    if (/^\/generation\/[\w-]+\/user-style\/[\w-]+$/.test(path)) {
      requests.push({ url: path, method: 'POST' })
      const [, , imageId, , styleId] = path.split('/')
      const style = userStyles.find((s) => s.id === styleId)
      if (!style) return json({ message: 'Nie znaleziono stylu' }, 404)
      const gen = { id: `gen-${styleId}-${userStyleGenerations.length}`, imageId, style: 'custom', styleLabel: style.name, status: 'COMPLETED', url: '/api/uploads/generated/us.png', rating: null }
      if (imageId === IMAGE.id) userStyleGenerations.push(gen)
      return json({ generationId: gen.id }, 201)
    }
    if (path === `/generation/${IMAGE.id}/custom`) {
      requests.push({ url: path, method: 'POST', body: req.postData() })
      return json({ generationId: 'gen-3' }, 201)
    }
    if (path === `/generation/${IMAGE.id}/start`) {
      const body = req.postDataJSON()
      requests.push({ url: path, method: 'POST', body })
      return json({ message: 'Generation started', generationIds: ['gen-9'], styles: body?.styles ?? STYLES.defaultStyleIds, count: body?.styles?.length ?? 3 }, 201)
    }
    if (path === '/generation/retry/gen-2') {
      requests.push({ url: path, method: 'POST' })
      return json({ message: 'Retry started' }, 201)
    }
    if (path === '/generation/feedback/gen-1') {
      requests.push({ url: path, method: 'POST', body: req.postDataJSON() })
      return json({ ok: true }, 201)
    }
    if (/^\/images\/img-new-\d+$/.test(path) && req.method() === 'GET') {
      const id = path.split('/').pop()!
      return json({ ...IMAGE, id, originalUrl: `/api/uploads/originals/${id}.jpg`, generations: [] })
    }
    if (/^\/generation\/img-new-\d+\/results$/.test(path)) return json([])
    if (/^\/descriptions\/img-new-\d+$/.test(path) && req.method() === 'GET')
      return json({ description: null, promptEditsLimit: 5, promptEditsLeft: 5, canCreate: true, creditCost: 0, editPackSize: 15, editPackCredits: 1 })
    if (/^\/descriptions\/img-new-\d+$/.test(path) && req.method() === 'POST') {
      requests.push({ url: path, method: 'POST', body: req.postDataJSON() })
      return json({ description: { ...DESCRIPTION }, promptEditsLimit: 5, promptEditsLeft: 5, canCreate: true, creditCost: 0, editPackSize: 15, editPackCredits: 1 }, 201)
    }
    if (path === '/auth/reset-password') {
      requests.push({ url: path, method: req.method(), body: req.postDataJSON() })
      return json({ message: 'Hasło zostało zmienione. Możesz się teraz zalogować.' })
    }
    if (path === '/payments/checkout') {
      requests.push({ url: path, method: req.method(), body: req.postDataJSON() })
      return json({ url: 'http://localhost:4173/credits?success=1' }, 201)
    }
    if (path === '/payments/welcome-offer')
      return json(
        options.hasPurchased
          ? { available: false, package: null }
          : {
              available: true,
              package: { id: 'welcome_5', credits: 5, priceGrosze: 500, label: 'Pakiet powitalny – 5 kredytów', priceLabel: '5 zł', savingLabel: 'Pierwszy zakup -50%', welcome: true },
            },
      )
    if (path === '/payments/packages') return json([{ id: 'credits_5', credits: 5, priceGrosze: 1000, label: '5 kredytów', priceLabel: '10 zł', savingLabel: null }])
    if (path === '/payments/history') return json(options.history ?? [])
    if (path === '/generation/styles') return json(STYLES)
    if (path === '/images')
      return json({ images: images.map((i) => ({ ...i, hasDescription: i.id === IMAGE.id && Boolean(description) })), pagination: { page: 1, limit: 20, total: images.length, pages: 1 } })
    if (path === `/images/${IMAGE.id}` && req.method() === 'DELETE') {
      requests.push({ url: path, method: 'DELETE' })
      images.splice(0, images.length)
      return json({ message: 'Image deleted' })
    }
    if (path === `/images/${IMAGE.id}`) return json(IMAGE)
    if (path === `/generation/${IMAGE.id}/results`) return json([...IMAGE.generations, ...userStyleGenerations])
    const extra = images.find((i) => i.id !== IMAGE.id && (path === `/generation/${i.id}/results` || path === `/descriptions/${i.id}`))
    if (extra && path.endsWith('/results')) return json(extra.generations)
    if (extra && path.startsWith('/descriptions/') && req.method() === 'GET')
      return json({
        description: null,
        promptEditsLimit: 5,
        promptEditsLeft: 5,
        canCreate: extra.generations.some((g: any) => g.status === 'COMPLETED'),
        creditCost: 0,
        editPackSize: 15,
        editPackCredits: 1,
      })
    if (extra && path.startsWith('/descriptions/') && req.method() === 'POST') {
      requests.push({ url: path, method: 'POST', body: req.postDataJSON() })
      return json({ description: { ...DESCRIPTION }, promptEditsLimit: 5, promptEditsLeft: 5, canCreate: true, creditCost: 0, editPackSize: 15, editPackCredits: 1 }, 201)
    }
    if (path.startsWith('/uploads/')) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_BYTES })
    if (path === '/generation/download/gen-1') {
      requests.push({ url: path, method: req.method() })
      return route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'Content-Disposition': 'attachment; filename="grafika-white-bg.png"' },
        body: PNG_BYTES,
      })
    }
    if (path === '/generation/export/gen-1') {
      const body = req.postDataJSON()
      requests.push({ url: path, method: req.method(), body })
      const ext = body?.format === 'png' ? 'png' : body?.format === 'webp' ? 'webp' : 'jpg'
      return route.fulfill({
        status: 201,
        contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        headers: { 'Content-Disposition': `attachment; filename="grafika-white-bg-${body?.platform ? `${body.platform}-` : ''}${(body?.ratio || '1:1').replace(':', 'x')}.${ext}"` },
        body: PNG_BYTES,
      })
    }
    if (path === `/generation/export-original/${IMAGE.id}`) {
      const body = req.postDataJSON()
      requests.push({ url: path, method: req.method(), body })
      const ext = body?.format === 'png' ? 'png' : 'jpg'
      return route.fulfill({
        status: 201,
        contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        headers: { 'Content-Disposition': `attachment; filename="zdjecie-${body?.platform ? `${body.platform}-` : ''}${(body?.ratio || '1:1').replace(':', 'x')}.${ext}"` },
        body: PNG_BYTES,
      })
    }
    if (path === `/descriptions/${IMAGE.id}` && req.method() === 'GET') return json(descriptionView())
    if (path === `/descriptions/${IMAGE.id}` && req.method() === 'POST') {
      const body = req.postDataJSON()
      requests.push({ url: path, method: 'POST', body })
      const platform: PlatformId = body?.platform ?? description?.platform ?? 'generic'
      description = { ...DESCRIPTION, sellerNotes: body?.notes ?? null, platform, titleMaxLength: PLATFORM_PRESETS[platform].titleMaxLength, promptEditsUsed: description?.promptEditsUsed ?? 0 }
      return json(descriptionView(), 201)
    }
    if (path === `/descriptions/${IMAGE.id}` && req.method() === 'PATCH') {
      const body = req.postDataJSON()
      requests.push({ url: path, method: 'PATCH', body })
      const platform: PlatformId = body.platform ?? description!.platform
      description = { ...description!, title: body.title, body: body.body, keywords: body.keywords ?? description!.keywords, platform, titleMaxLength: PLATFORM_PRESETS[platform].titleMaxLength }
      return json(descriptionView())
    }
    if (path === `/descriptions/${IMAGE.id}/edit-packs`) {
      requests.push({ url: path, method: 'POST' })
      if (options.noCredits) return json({ statusCode: 402, error: 'Payment Required', message: 'Niewystarczająca liczba kredytów.', creditsRequired: 1, creditsAvailable: 0 }, 402)
      editsPurchased += 15
      return json(descriptionView(), 201)
    }
    if (path === '/images/upload') {
      uploadCounter++
      const id = `img-new-${uploadCounter}`
      requests.push({ url: path, method: 'POST' })
      return json({ id, originalUrl: `/api/uploads/originals/${id}.jpg`, filename: `${id}.jpg`, createdAt: '2026-10-03T00:00:00.000Z', generations: [] }, 201)
    }
    if (/^\/generation\/img-new-\d+\/start$/.test(path)) {
      requests.push({ url: path, method: 'POST', body: req.postDataJSON() })
      return json({ message: 'Generation started', generationIds: ['g1'], styles: req.postDataJSON()?.styles ?? STYLES.defaultStyleIds, count: 1 }, 201)
    }
    if (path === `/descriptions/${IMAGE.id}/refine`) {
      const body = req.postDataJSON()
      requests.push({ url: path, method: 'POST', body })
      if (description!.promptEditsUsed >= 5 + editsPurchased)
        return json(
          { statusCode: 402, message: 'Wykorzystano wszystkie poprawki promptem dla tego zdjęcia. Dokup pakiet 15 poprawek za 1 kredyt albo edytuj opis ręcznie.', code: 'EDIT_PACK_REQUIRED' },
          402,
        )
      description = {
        ...description!,
        title: `${description!.title} (poprawiony)`,
        body: `${description!.body}<p>Poprawka: ${body.instruction}</p>`,
        promptEditsUsed: description!.promptEditsUsed + 1,
      }
      return json(descriptionView(), 201)
    }
    if (path === '/payments/subscription') return json({ subscription: null })
    if (path === '/payments/plans') return json([])
    return json({ message: `unmocked ${path}` }, 404)
  })

  return { requests }
}
