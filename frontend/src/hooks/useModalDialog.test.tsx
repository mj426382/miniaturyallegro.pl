import { useRef, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import Modal from '../components/Modal'
import { tabbableElements } from './useModalDialog'
import { ConfirmProvider } from '../components/ConfirmDialog'
import { useConfirm } from './useConfirm'

/**
 * Spec 11, AC-UI-010 / AC-UI-011: the shared modal behaviour in isolation (jsdom has no layout and no native Tab,
 * so the hook's own Tab handling is exercised directly; the browser behaviour is covered in e2e/modals.spec.ts).
 */
afterEach(cleanup)

const tab = (shift = false) => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Tab', shiftKey: shift })
const escape = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })

function Page({ dismissible = true, withRadios = false }: { dismissible?: boolean; withRadios?: boolean }) {
  const [open, setOpen] = useState(false)
  const firstRef = useRef<HTMLButtonElement>(null)
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Otwórz
      </button>
      <a href="#tlo">Link w tle</a>
      {open && (
        <Modal onClose={() => setOpen(false)} labelledBy="t" dismissible={dismissible} initialFocus={firstRef}>
          <h2 id="t">Okno testowe</h2>
          <button ref={firstRef} type="button">
            Pierwszy
          </button>
          {withRadios && (
            <fieldset>
              <legend>Format</legend>
              <input type="radio" name="f" aria-label="JPG" defaultChecked />
              <input type="radio" name="f" aria-label="PNG" />
              <input type="radio" name="f" aria-label="WebP" />
            </fieldset>
          )}
          <input aria-label="Pole" />
          <button type="button" disabled>
            Wyłączony
          </button>
          <button type="button" onClick={() => setOpen(false)}>
            Ostatni
          </button>
        </Modal>
      )}
    </div>
  )
}

describe('[AC-UI-010] useModalDialog / Modal', () => {
  it('[AC-UI-010] names the dialog, moves focus in and makes everything else inert', () => {
    render(<Page />)
    const opener = screen.getByRole('button', { name: 'Otwórz' })
    opener.focus()
    fireEvent.click(opener)
    const dialog = screen.getByRole('dialog', { name: 'Okno testowe' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Pierwszy' }))
    // Portalled to <body>: the app root (the render container) is inert, the dialog root is not.
    const root = dialog.closest('[data-dialog-root]')!
    expect(root.parentElement).toBe(document.body)
    expect(root.hasAttribute('inert')).toBe(false)
    expect(opener.closest('[inert]')).not.toBeNull()
  })

  it('[AC-UI-010] Tab and Shift+Tab wrap around inside the dialog and skip disabled controls', () => {
    render(<Page />)
    fireEvent.click(screen.getByRole('button', { name: 'Otwórz' }))
    const first = screen.getByRole('button', { name: 'Pierwszy' })
    const last = screen.getByRole('button', { name: 'Ostatni' })
    // Every Tab is managed (same order in every engine): DOM order, disabled controls skipped.
    tab()
    expect(document.activeElement).toBe(screen.getByLabelText('Pole'))
    tab()
    expect(document.activeElement).toBe(last)
    tab()
    expect(document.activeElement).toBe(first)
    tab(true)
    tab(true)
    expect(document.activeElement).toBe(screen.getByLabelText('Pole'))
    last.focus()
    tab()
    expect(document.activeElement).toBe(first)
    tab(true)
    expect(document.activeElement).toBe(last)
    // Focus that somehow left the dialog comes back on the next Tab.
    act(() => (document.activeElement as HTMLElement).blur())
    tab()
    expect(document.activeElement).toBe(first)
  })

  it('[AC-UI-010] a radio group is a single tab stop (the checked radio)', () => {
    render(<Page withRadios />)
    fireEvent.click(screen.getByRole('button', { name: 'Otwórz' }))
    const names = tabbableElements(screen.getByRole('dialog')).map((el) => el.getAttribute('aria-label') ?? el.textContent)
    expect(names).toEqual(['Pierwszy', 'JPG', 'Pole', 'Ostatni'])
  })

  it('[AC-UI-010] Escape closes the dialog, lifts inert and returns focus to the opener', () => {
    render(<Page />)
    const opener = screen.getByRole('button', { name: 'Otwórz' })
    opener.focus()
    fireEvent.click(opener)
    escape()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.querySelectorAll('[inert]')).toHaveLength(0)
    expect(document.activeElement).toBe(opener)
  })

  it('[AC-UI-010] a non-dismissible dialog ignores Escape and the backdrop', () => {
    render(<Page dismissible={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Otwórz' }))
    escape()
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij okno' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

function ExportLike() {
  const [open, setOpen] = useState(false)
  const confirm = useConfirm()
  const close = async () => {
    if (await confirm({ title: 'Zamknąć bez pobierania?', message: 'Zmiany przepadną', confirmLabel: 'Zamknij bez pobierania', cancelLabel: 'Wróć do edycji' })) setOpen(false)
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Eksport
      </button>
      {open && (
        <Modal onClose={close} labelledBy="e">
          <h2 id="e">Eksport testowy</h2>
          <button type="button" onClick={close}>
            Zamknij
          </button>
          <input aria-label="Plakietka" />
        </Modal>
      )}
    </>
  )
}

describe('[AC-UI-011] nested confirmation inside a dialog', () => {
  const setup = () => {
    render(
      <ConfirmProvider>
        <ExportLike />
      </ConfirmProvider>,
    )
    const opener = screen.getByRole('button', { name: 'Eksport' })
    opener.focus()
    fireEvent.click(opener)
    return opener
  }

  it('[AC-UI-011] Escape first closes only the confirmation and focus goes back into the dialog', async () => {
    setup()
    const input = screen.getByLabelText('Plakietka')
    input.focus()
    escape()
    const alert = await screen.findByRole('alertdialog', { name: 'Zamknąć bez pobierania?' })
    // Only the top dialog is active: the export below is inert.
    expect(screen.getByRole('dialog', { hidden: true }).closest('[inert]')).not.toBeNull()
    expect(alert.closest('[inert]')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Zamknij bez pobierania' }))
    escape()
    await act(async () => undefined)
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Eksport testowy' })).toBeInTheDocument()
    expect(document.activeElement).toBe(input)
    expect(screen.getByRole('dialog').closest('[inert]')).toBeNull()
  })

  it('[AC-UI-011] confirming closes both dialogs and focus returns to the button that opened the first one', async () => {
    const opener = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Zamknij bez pobierania' }))
    await act(async () => undefined)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(document.querySelectorAll('[inert]')).toHaveLength(0)
    expect(document.activeElement).toBe(opener)
  })
})
