import { Page } from '@playwright/test'

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
  allegroOfferId: null,
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
  /** Spec 08 – a connected Allegro seller account. */
  allegroConnected?: boolean
  /** Pre-existing offer copy for IMAGE. */
  withDescription?: boolean
  /** Payment history rows. */
  history?: any[]
  /** Extra gallery photos (spec 15). */
  extraImages?: any[]
  /** IMAGE was imported from this Allegro offer. */
  imageOfferId?: string
  /** Spec 16: the account is listed in ADMIN_EMAILS. */
  isAdmin?: boolean
}

export async function mockApp(page: Page, options: MockOptions = {}) {
  const requests: Array<{ url: string; method: string; body?: any }> = []
  let loggedIn = options.loggedIn ?? true
  let emailVerified = options.emailVerified ?? true
  const settings = { marketingConsent: false, notifyBatchDone: true }
  const images: any[] = [IMAGE, ...(options.extraImages ?? [])]
  // Offer description state lives for the duration of the page – mirrors the API behaviour.
  let description: typeof DESCRIPTION | null = options.withDescription ? { ...DESCRIPTION } : null
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
  const adminEmails: any[] = []

  // Session is an httpOnly cookie – the SPA simply asks /users/me, which we answer as logged in.

  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname.replace(/^\/api/, '')
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

    if (path === '/users/me' && req.method() === 'GET')
      return loggedIn ? json({ ...USER, hasPassword: true, emailVerified, ...settings, isAdmin: Boolean(options.isAdmin) }) : json({ message: 'Unauthorized' }, 401)
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
    if (/^\/admin\/users\/[^/]+$/.test(path)) {
      const row = ADMIN_USERS.find((u) => path.endsWith(u.id))
      return row
        ? json({
            ...row,
            subscription: null,
            payments: [{ id: 'tx-1', amountPln: 2800, creditsAdded: 15, status: 'completed', kind: 'package', createdAt: '2026-10-03T10:00:00.000Z', hasInvoice: true }],
            emails: adminEmails,
          })
        : json({ message: 'Nie znaleziono' }, 404)
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
    if (path === '/allegro/offers') return json({ offers: [{ id: 'off-1', name: 'Kubek ceramiczny – oferta', primaryImage: null, status: 'ACTIVE', price: '29.99 PLN' }], total: 1 })
    if (/^\/allegro\/offers\/[^/]+\/description$/.test(path)) {
      requests.push({ url: path, method: 'POST', body: req.postDataJSON() })
      return json({ offerId: 'off-1', mode: req.postDataJSON()?.mode, titleUpdated: Boolean(req.postDataJSON()?.updateTitle), sections: 1 }, 201)
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
      if (body?.password !== PASSWORD) return json({ message: 'Nieprawidłowy email lub hasło' }, 401)
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
    if (path === `/images/${IMAGE.id}`) return json({ ...IMAGE, allegroOfferId: options.imageOfferId ?? null })
    if (path === `/generation/${IMAGE.id}/results`) return json(IMAGE.generations)
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
        headers: { 'Content-Disposition': `attachment; filename="grafika-white-bg-${(body?.ratio || '1:1').replace(':', 'x')}.${ext}"` },
        body: PNG_BYTES,
      })
    }
    if (path === `/descriptions/${IMAGE.id}` && req.method() === 'GET') return json(descriptionView())
    if (path === `/descriptions/${IMAGE.id}` && req.method() === 'POST') {
      const body = req.postDataJSON()
      requests.push({ url: path, method: 'POST', body })
      description = { ...DESCRIPTION, sellerNotes: body?.notes ?? null, promptEditsUsed: description?.promptEditsUsed ?? 0 }
      return json(descriptionView(), 201)
    }
    if (path === `/descriptions/${IMAGE.id}` && req.method() === 'PATCH') {
      const body = req.postDataJSON()
      requests.push({ url: path, method: 'PATCH', body })
      description = { ...description!, title: body.title, body: body.body, keywords: body.keywords ?? description!.keywords }
      return json(descriptionView())
    }
    if (path === `/descriptions/${IMAGE.id}/edit-packs`) {
      requests.push({ url: path, method: 'POST' })
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
    if (path === '/allegro/status') return json(options.allegroConnected ? { configured: true, connected: true, sellerLogin: 'sklep' } : { configured: false, connected: false, sellerLogin: null })
    if (path === '/payments/subscription') return json({ subscription: null })
    if (path === '/payments/plans') return json([])
    return json({ message: `unmocked ${path}` }, 404)
  })

  return { requests }
}
