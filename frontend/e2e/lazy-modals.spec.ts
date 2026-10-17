import { test, expect, Locator, Page } from '@playwright/test'
import { readFileSync, readdirSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { IMAGE, mockApp } from './fixtures'

/**
 * Spec 17, AC-PERF-006 / AC-PERF-007: dialogs are separate chunks. A screen does not import them statically, the
 * browser does not fetch them before the user's first interaction, and afterwards they open without network.
 */
const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/assets')
const DIALOG_CHUNK = /^(ExportModal|InfographicModal|PaywallModal|BulkDescriptionsModal|AdminUserModal)-[\w-]+\.js$/
const chunkName = (url: string) => url.split('/').pop()!.split('?')[0]

/** Every chunk loaded together with `entry`: its static imports, transitively (dynamic import() is skipped). */
function staticGraph(entry: string): Set<string> {
  const seen = new Set<string>()
  const queue = [entry]
  while (queue.length) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    const code = readFileSync(join(ASSETS, file), 'utf-8')
    for (const m of code.matchAll(/(?:\bfrom|\bimport)\s*["']\.\/([\w.-]+\.js)["']/g)) queue.push(m[1])
  }
  return seen
}

test.describe('[AC-PERF-006] build output', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'desktop-chrome', 'build output is device-independent')
  })

  test('[AC-PERF-006] screens do not pull dialog chunks (or the crop library) into their static graph', () => {
    const files = readdirSync(ASSETS).filter((f) => f.endsWith('.js'))
    const dialogChunks = files.filter((f) => DIALOG_CHUNK.test(f))
    expect(dialogChunks.map((f) => f.split('-')[0]).sort()).toEqual(['AdminUserModal', 'BulkDescriptionsModal', 'ExportModal', 'InfographicModal', 'PaywallModal'])

    for (const screen of ['Generate', 'Gallery', 'BulkUpload', 'Admin']) {
      const entry = files.find((f) => f.startsWith(`${screen}-`))!
      const graph = [...staticGraph(entry)]
      expect(
        graph.filter((f) => DIALOG_CHUNK.test(f)),
        `${screen} loads dialog chunks statically`,
      ).toEqual([])
      // react-easy-crop (export framing) travels with the export dialog only.
      for (const file of graph) expect(readFileSync(join(ASSETS, file), 'utf-8'), `${file} (static graph of ${screen})`).not.toContain('reactEasyCrop_Container')
    }
    expect(
      readFileSync(
        join(
          ASSETS,
          dialogChunks.find((f) => f.startsWith('ExportModal-'))!,
        ),
        'utf-8',
      ),
    ).toContain('reactEasyCrop_Container')
  })
})

async function recordChunks(page: Page) {
  const requested: string[] = []
  page.on('request', (r) => {
    if (r.url().includes('/assets/') && r.url().endsWith('.js')) requested.push(chunkName(r.url()))
  })
  return requested
}

test('[AC-PERF-006, AC-PERF-007] the generator fetches its dialogs on the first interaction; then they open offline in under 1 s', async ({ page }) => {
  const requested = await recordChunks(page)
  await mockApp(page, { noCredits: true })
  await page.goto(`/generate/${IMAGE.id}`)
  await expect(page.getByRole('heading', { name: 'Generator grafik produktowych' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(
    requested.some((f) => f.startsWith('Generate-')),
    'the generator chunk itself was loaded',
  ).toBe(true)
  expect(
    requested.filter((f) => DIALOG_CHUNK.test(f)),
    'dialog chunks fetched before any interaction',
  ).toEqual([])

  // First interaction (a key press works on every device) → the dialogs are prefetched in the background.
  await page.keyboard.press('Shift')
  await expect
    .poll(() =>
      requested
        .filter((f) => DIALOG_CHUNK.test(f))
        .map((f) => f.split('-')[0])
        .sort(),
    )
    .toEqual(['ExportModal', 'InfographicModal', 'PaywallModal'])
  await page.waitForLoadState('networkidle')

  await page.context().setOffline(true)
  const more = page.getByRole('button', { name: 'Więcej akcji' }).first()
  const opens: Array<{ name: string; prepare?: () => Promise<void>; trigger: Locator; dialog: Locator }> = [
    { name: 'export', prepare: () => more.click(), trigger: page.getByRole('menuitem', { name: 'Eksport i edycja' }), dialog: page.getByRole('dialog', { name: 'Eksportuj grafikę' }) },
    { name: 'export of the original', trigger: page.getByRole('button', { name: /Eksportuj oryginał/ }), dialog: page.getByRole('dialog', { name: 'Eksportuj oryginalne zdjęcie' }) },
    { name: 'infographic', prepare: () => more.click(), trigger: page.getByRole('menuitem', { name: 'Infografika' }), dialog: page.getByRole('dialog', { name: 'Infografika – zdjęcie dodatkowe' }) },
    {
      name: 'offer',
      prepare: async () => {
        if (await page.getByRole('button', { name: 'Pokaż style' }).isVisible()) await page.getByRole('button', { name: 'Pokaż style' }).click()
      },
      trigger: page.getByRole('button', { name: /^Generuj \d+ grafik/ }),
      dialog: page.getByRole('dialog', { name: /Brakuje Ci/ }),
    },
  ]
  const before = requested.length
  for (const o of opens) {
    await o.prepare?.()
    await expect(o.trigger).toBeVisible()
    // Measured from the click that opens the dialog to the dialog on screen.
    const started = Date.now()
    await o.trigger.click()
    await expect(o.dialog, `${o.name} opens offline`).toBeVisible({ timeout: 1000 })
    expect(Date.now() - started, `${o.name} took too long`).toBeLessThan(1000)
    await page.keyboard.press('Escape')
    await expect(o.dialog).toHaveCount(0)
  }
  expect(
    requested.slice(before).filter((f) => DIALOG_CHUNK.test(f)),
    'no dialog chunk was fetched again',
  ).toEqual([])
  await page.context().setOffline(false)
})

test('[AC-PERF-006] the gallery and the admin panel load their dialogs only after the first interaction', async ({ page }) => {
  const requested = await recordChunks(page)
  await mockApp(page, { isAdmin: true })
  await page.goto('/gallery')
  await expect(page.getByRole('heading', { name: 'Galeria zdjęć' })).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(requested.filter((f) => DIALOG_CHUNK.test(f))).toEqual([])
  await page.keyboard.press('Shift')
  await expect.poll(() => requested.filter((f) => f.startsWith('BulkDescriptionsModal-')).length).toBe(1)

  await page.goto('/admin')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.waitForLoadState('networkidle')
  expect(requested.filter((f) => f.startsWith('AdminUserModal-'))).toEqual([])
  await page.keyboard.press('Shift')
  await expect.poll(() => requested.filter((f) => f.startsWith('AdminUserModal-')).length).toBe(1)
})
