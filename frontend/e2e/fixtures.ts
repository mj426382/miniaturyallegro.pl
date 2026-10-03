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
    { id: 'white-bg', name: 'Białe tło', description: 'Czyste białe tło', starter: true },
    { id: 'lifestyle-home', name: 'Lifestyle – wnętrze', description: 'Wnętrze', starter: true },
    { id: 'dark-luxury', name: 'Ciemny luksus', description: 'Ciemne tło', starter: true },
    { id: 'gradient-bg', name: 'Gradient', description: 'Gradient', starter: false },
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

export async function mockApp(page: Page, options: { loggedIn?: boolean } = {}) {
  const requests: Array<{ url: string; method: string; body?: any }> = []
  let loggedIn = options.loggedIn ?? true
  const images: any[] = [IMAGE]
  // Offer description state lives for the duration of the page – mirrors the API behaviour.
  let description: typeof DESCRIPTION | null = null
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

  // Session is an httpOnly cookie – the SPA simply asks /users/me, which we answer as logged in.

  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname.replace(/^\/api/, '')
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

    if (path === '/users/me' && req.method() === 'GET') return loggedIn ? json({ ...USER, hasPassword: true }) : json({ message: 'Unauthorized' }, 401)
    if (path === '/users/me' && req.method() === 'PATCH') {
      requests.push({ url: path, method: 'PATCH', body: req.postDataJSON() })
      return json({ ...USER, hasPassword: true, name: req.postDataJSON()?.name ?? USER.name })
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
    if (path === '/auth/reset-password') {
      requests.push({ url: path, method: req.method(), body: req.postDataJSON() })
      return json({ message: 'Hasło zostało zmienione. Możesz się teraz zalogować.' })
    }
    if (path === '/payments/checkout') {
      requests.push({ url: path, method: req.method(), body: req.postDataJSON() })
      return json({ url: 'http://localhost:4173/credits?success=1' }, 201)
    }
    if (path === '/payments/packages') return json([{ id: 'credits_5', credits: 5, priceGrosze: 1000, label: '5 kredytów', priceLabel: '10 zł', savingLabel: null }])
    if (path === '/payments/history') return json([])
    if (path === '/generation/styles') return json(STYLES)
    if (path === '/images')
      return json({ images: images.map((i) => ({ ...i, hasDescription: i.id === IMAGE.id && Boolean(description) })), pagination: { page: 1, limit: 20, total: images.length, pages: 1 } })
    if (path === `/images/${IMAGE.id}` && req.method() === 'DELETE') {
      requests.push({ url: path, method: 'DELETE' })
      images.splice(0, images.length)
      return json({ message: 'Image deleted' })
    }
    if (path === `/images/${IMAGE.id}`) return json(IMAGE)
    if (path === `/generation/${IMAGE.id}/results`) return json(IMAGE.generations)
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
    if (path === '/allegro/status') return json({ configured: false, connected: false, sellerLogin: null })
    if (path === '/payments/subscription') return json({ subscription: null })
    if (path === '/payments/plans') return json([])
    return json({ message: `unmocked ${path}` }, 404)
  })

  return { requests }
}
