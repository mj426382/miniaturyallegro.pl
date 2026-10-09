import { test, expect } from '@playwright/test'

/** Spec 19, AC-MON-007: the landing page and the terms promise 5 free graphics to new accounts. */
test('[AC-MON-007] the home page promises 5 free graphics and lists them in the structured data', async ({ request }) => {
  const html = await (await request.get('/')).text()
  expect(html).toContain('Pierwsze 5 grafik za darmo')
  expect(html).not.toMatch(/10 grafik (za darmo|gratis)/)
  expect(html).toMatch(/"description":"Pierwsze 5 grafik za darmo"/)
})

test('[AC-MON-007] the terms give 5 free credits and keep 10 for accounts created before the change', async ({ request }) => {
  const html = (await (await request.get('/regulamin')).text()).replace(/<!-- -->/g, '')
  expect(html).toContain('Każdy nowy Użytkownik otrzymuje 5 darmowych Kredytów')
  expect(html).toContain('zachowują dotychczasową pulę 10 darmowych Kredytów')
  expect(html).toContain('pakiet powitalny 5 Kredytów w cenie 5 zł')
})
