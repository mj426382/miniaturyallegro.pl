import { test, expect, Page } from '@playwright/test'
import { mockApp, IMAGE } from './fixtures'

/**
 * Downloading generated graphics must work on every platform our sellers use:
 * desktop browsers save a file, phones get the native share sheet ("Zapisz obraz").
 * Each test runs on all configured devices (desktop Chrome/Safari, iPhone 14, Pixel 7).
 */

function isMobile(page: Page) {
  return page.viewportSize()!.width < 768
}

/** The export lives in the card's overflow menu. */
async function openExport(page: Page) {
  await page.getByRole('button', { name: 'Więcej akcji' }).first().click()
  await page.getByRole('menuitem', { name: 'Eksport i edycja' }).click()
}

async function openGenerator(page: Page) {
  await page.goto(`/generate/${IMAGE.id}`)
  await expect(page.getByRole('heading', { name: 'Generator grafik produktowych' })).toBeVisible()
  await expect(page.getByText('Białe tło', { exact: true }).first()).toBeVisible()
}

/** Installs a fake Web Share API so the share path can be observed on phones. */
async function installShareSpy(page: Page, options: { canShare: boolean } = { canShare: true }) {
  await page.addInitScript((canShare) => {
    const w = window as any
    w.__shared = []
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => canShare })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: any) => {
        w.__shared.push({ title: data.title, files: (data.files || []).map((f: File) => ({ name: f.name, type: f.type, size: f.size })) })
      },
    })
  }, options.canShare)
}

test.describe('download of a generated graphic', () => {
  test('[AC-EXP-009] desktop browsers save the file with the style name', async ({ page }) => {
    test.skip(isMobile(page), 'desktop behaviour only')
    const { requests } = await mockApp(page)
    await openGenerator(page)

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Pobierz' }).first().click()
    const download = await downloadPromise

    expect(download.suggestedFilename()).toBe('grafika-white-bg.png')
    const path = await download.path()
    expect(path).toBeTruthy()
    expect(requests.some((r) => r.url === '/generation/download/gen-1')).toBe(true)
  })

  test('[AC-EXP-010] phones (iPhone / Android) get the native share sheet with an image file', async ({ page }) => {
    test.skip(!isMobile(page), 'mobile behaviour only')
    await installShareSpy(page)
    await mockApp(page)
    await openGenerator(page)

    await page.getByRole('button', { name: 'Pobierz' }).first().tap()
    await expect.poll(() => page.evaluate(() => (window as any).__shared.length)).toBe(1)
    const shared = await page.evaluate(() => (window as any).__shared[0])
    expect(shared.files).toEqual([{ name: 'grafika-white-bg.png', type: 'image/png', size: expect.any(Number) }])
    expect(shared.files[0].size).toBeGreaterThan(0)
  })

  test('[AC-EXP-011] phones without file sharing still get the image (download or new tab)', async ({ page, context }) => {
    test.skip(!isMobile(page), 'mobile behaviour only')
    await installShareSpy(page, { canShare: false })
    await mockApp(page)
    await openGenerator(page)

    const outcome = Promise.race([
      page.waitForEvent('download').then((d) => ({ kind: 'download', name: d.suggestedFilename() })),
      context.waitForEvent('page').then(async (p) => ({ kind: 'tab', name: p.url() })),
    ])
    // whichever waiter loses the race must not surface as an unhandled rejection at teardown
    outcome.catch(() => undefined)
    await page.getByRole('button', { name: 'Pobierz' }).first().tap()
    const result = await outcome
    if (result.kind === 'download') expect(result.name).toBe('grafika-white-bg.png')
    else expect(result.name).toContain('blob:')
  })
})

test.describe('export in marketplace formats', () => {
  test('[AC-EXP-012] exports a 4:3 gallery JPEG with a promo badge', async ({ page }) => {
    const mobile = isMobile(page)
    if (mobile) await installShareSpy(page)
    const { requests } = await mockApp(page)
    await openGenerator(page)

    await openExport(page)
    const dialog = page.getByRole('dialog', { name: 'Eksportuj grafikę' })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Allegro – galeria 4:3').check()
    // Non-square formats default to framing; this test covers the "whole graphic on white" path.
    await dialog.getByLabel('Cała grafika').check()
    await dialog.getByRole('button', { name: 'Dalej' }).click()
    await dialog.getByPlaceholder('np. -20%, NOWOŚĆ, DARMOWA DOSTAWA').fill('-20%')

    if (mobile) {
      await dialog.getByRole('button', { name: 'Pobierz', exact: true }).click()
      await expect.poll(() => page.evaluate(() => (window as any).__shared.length)).toBe(1)
      const shared = await page.evaluate(() => (window as any).__shared[0])
      expect(shared.files[0].name).toBe('grafika-white-bg-4x3.jpg')
    } else {
      const downloadPromise = page.waitForEvent('download')
      await dialog.getByRole('button', { name: 'Pobierz', exact: true }).click()
      expect((await downloadPromise).suggestedFilename()).toBe('grafika-white-bg-4x3.jpg')
    }

    const exportReq = requests.find((r) => r.url === '/generation/export/gen-1')!
    expect(exportReq.body).toMatchObject({ ratio: '4:3', size: 1600, format: 'jpeg', badgeText: '-20%', badgeColor: 'red', badgePosition: 'top-left' })
    expect(exportReq.body.crop).toBeUndefined()
  })

  test('[AC-EXP-013] sends rotation and tone corrections with the export', async ({ page }) => {
    const mobile = isMobile(page)
    if (mobile) await installShareSpy(page)
    const { requests } = await mockApp(page)
    await openGenerator(page)

    await openExport(page)
    const dialog = page.getByRole('dialog', { name: 'Eksportuj grafikę' })
    await dialog.getByRole('button', { name: 'Obróć w prawo o 90 stopni' }).click()
    await dialog.getByRole('button', { name: 'Obróć w prawo o 90 stopni' }).click()
    await dialog.getByRole('button', { name: 'Obróć w lewo o 90 stopni' }).click()
    await expect(dialog.getByTestId('rotation-label')).toHaveText('90°')

    await dialog.getByRole('button', { name: 'Dalej' }).click()
    await dialog.getByLabel('Jasność').fill('1.2')
    await dialog.getByLabel('Nasycenie').fill('0.5')
    await dialog.getByLabel('Lekko wyostrz').check()

    const download = dialog.getByRole('button', { name: 'Pobierz', exact: true })
    if (mobile) {
      await download.click()
      await expect.poll(() => page.evaluate(() => (window as any).__shared.length)).toBe(1)
    } else {
      const downloadPromise = page.waitForEvent('download')
      await download.click()
      await downloadPromise
    }
    const exportReq = requests.find((r) => r.url === '/generation/export/gen-1')!
    expect(exportReq.body).toMatchObject({ ratio: '1:1', rotate: 90, adjust: { brightness: 1.2, contrast: 1, saturation: 0.5, sharpen: true } })
    expect(exportReq.body.crop).toBeUndefined()
  })

  test('[AC-EXP-014] lets the seller frame a 3:4 crop instead of getting white bars', async ({ page }) => {
    const mobile = isMobile(page)
    if (mobile) await installShareSpy(page)
    const { requests } = await mockApp(page)
    await openGenerator(page)

    await openExport(page)
    const dialog = page.getByRole('dialog', { name: 'Eksportuj grafikę' })
    await dialog.getByLabel('Social / stories 3:4').check()
    await expect(dialog.getByLabel('Kadruj')).toBeChecked()
    const editor = dialog.getByTestId('crop-editor')
    await expect(editor).toBeVisible()
    const next = dialog.getByRole('button', { name: 'Dalej' })
    await expect(next).toBeEnabled()

    if (!mobile) {
      // Drag the graphic to the right: the frame moves towards the left edge of the image.
      const box = (await editor.boundingBox())!
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 6 })
      await page.mouse.up()
    }
    await next.click()
    const download = dialog.getByRole('button', { name: 'Pobierz', exact: true })

    if (mobile) {
      await download.click()
      await expect.poll(() => page.evaluate(() => (window as any).__shared.length)).toBe(1)
    } else {
      const downloadPromise = page.waitForEvent('download')
      await download.click()
      expect((await downloadPromise).suggestedFilename()).toBe('grafika-white-bg-3x4.jpg')
    }

    const exportReq = requests.find((r) => r.url === '/generation/export/gen-1')!
    expect(exportReq.body).toMatchObject({ ratio: '3:4', size: 1800, format: 'jpeg' })
    const crop = exportReq.body.crop
    // A square graphic framed 3:4: full height, three quarters of the width, never outside the image.
    expect(crop.height).toBeCloseTo(1, 1)
    expect(crop.width).toBeCloseTo(0.75, 1)
    expect(crop.top).toBeCloseTo(0, 1)
    expect(crop.left).toBeGreaterThanOrEqual(0)
    expect(crop.left + crop.width).toBeLessThanOrEqual(1.001)
    if (!mobile) expect(crop.left).toBeLessThan(0.125)
    else expect(crop.left).toBeCloseTo(0.125, 1)
  })
})
