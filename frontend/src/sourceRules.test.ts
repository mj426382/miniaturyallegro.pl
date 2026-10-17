import { readdirSync, readFileSync, statSync } from 'fs'
import { dirname, join, relative, resolve } from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

/**
 * Code-level rules that keep the UI consistent (spec 11 AC-UI-015/016, spec 17 AC-PERF-006):
 * one modal implementation, identical copies shared with the landing page, one place for upload-limit codes,
 * no hard-coded subscription prices and no static imports of dialogs in screens.
 */
const SRC = dirname(fileURLToPath(import.meta.url))
const LANDING_SRC = resolve(SRC, '../../landing-page/src')

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) files(full, out)
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full)
  }
  return out
}
const sources = files(SRC).map((file) => ({ file: relative(SRC, file).replace(/\\/g, '/'), text: readFileSync(file, 'utf-8') }))

describe('[AC-UI-015] one modal implementation', () => {
  it('[AC-UI-015] only Modal (and the shared cookie banner) render a modal element; no dialog listens for Escape itself', () => {
    const dialogs = sources.filter((s) => /aria-modal/.test(s.text)).map((s) => s.file)
    expect(dialogs.sort()).toEqual(['components/Modal.tsx', 'consent/CookieBanner.tsx'])
    const modals = sources.filter((s) => /Modal\.tsx$|ConfirmDialog\.tsx$/.test(s.file) && s.file !== 'components/Modal.tsx')
    expect(modals.map((m) => m.file).sort()).toEqual([
      'components/AdminUserModal.tsx',
      'components/BulkDescriptionsModal.tsx',
      'components/ConfirmDialog.tsx',
      'components/ExportModal.tsx',
      'components/InfographicModal.tsx',
      'components/PaywallModal.tsx',
    ])
    for (const m of modals) {
      expect(m.text, m.file).toMatch(/<Modal\b/)
      expect(m.text, m.file).not.toMatch(/['"]Escape['"]/)
      expect(m.text, m.file).not.toMatch(/fixed inset-0/)
    }
  })

  it('[AC-UI-015] the dialog hook and the cookie banner are identical in the app and on the landing page', () => {
    for (const file of ['hooks/useModalDialog.ts', 'consent/CookieBanner.tsx']) {
      expect(readFileSync(join(SRC, file), 'utf-8'), `${file} differs between frontend/src and landing-page/src`).toBe(readFileSync(join(LANDING_SRC, file), 'utf-8'))
    }
  })

  it('[AC-UI-015] upload-limit codes are defined only in utils/uploadLimits.ts', () => {
    const users = sources.filter((s) => /UPLOAD_LIMIT_UNVERIFIED|UPLOAD_LIMIT_DAILY/.test(s.text)).map((s) => s.file)
    expect(users).toEqual(['utils/uploadLimits.ts'])
    for (const screen of ['pages/Upload.tsx', 'pages/BulkUpload.tsx']) {
      expect(sources.find((s) => s.file === screen)!.text, screen).toMatch(/uploadLimitError\(err\)/)
    }
  })
})

describe('[AC-PERF-006] dialogs are lazy chunks', () => {
  it('[AC-PERF-006] screens never import a dialog component statically (only types and lazyModals)', () => {
    const dialogModules = ['ExportModal', 'InfographicModal', 'PaywallModal', 'BulkDescriptionsModal', 'AdminUserModal']
    for (const s of sources.filter((x) => !x.file.startsWith('components/lazyModals'))) {
      // One match per import statement (lazy up to its `from '…'`); `import type` is erased at build time.
      const imports = [...s.text.matchAll(/^import\s([\s\S]*?)from\s+['"]([^'"]+)['"]/gm)].filter((m) => !m[1].startsWith('type '))
      for (const name of dialogModules) {
        expect(
          imports.some((m) => m[2].endsWith(`/${name}`)),
          `${s.file} imports ${name} statically`,
        ).toBe(false)
      }
    }
    const lazy = sources.find((s) => s.file === 'components/lazyModals.ts')!.text
    for (const name of dialogModules) expect(lazy).toContain(`lazyModal(() => import('./${name}'))`)
  })
})

describe('[AC-UI-016] subscription prices come from the API', () => {
  it('[AC-UI-016] the app code has no hard-coded plan prices (legal texts are synced from the landing page)', () => {
    for (const s of sources.filter((x) => !x.file.startsWith('legal/'))) {
      expect(s.text, s.file).not.toMatch(/\b(19|49|59|149) ?zł ?\/ ?mies/)
      expect(s.text, s.file).not.toMatch(/(Start|Pro)['"]?,?\s*(price|priceGrosze|priceLabel)\s*:/)
    }
    const credits = sources.find((s) => s.file === 'pages/Credits.tsx')!.text
    expect(credits).toContain('{plan.priceLabel}')
    expect(credits).toContain('{plan.description}')
  })
})
