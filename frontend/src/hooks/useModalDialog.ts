import { useEffect, useRef, type RefObject } from 'react'

/**
 * Spec 11 (AC-UI-010, AC-UI-011, AC-UI-015): the one implementation of modal behaviour.
 *
 * - a stack of open dialogs: only the top one reacts to Escape and Tab (nested confirm inside export),
 * - everything outside the top dialog gets `inert` (no clicks, no keyboard, hidden from screen readers),
 * - Tab / Shift+Tab cycle inside the dialog (a radio group is one stop),
 * - focus moves in on open and back to the element that opened the dialog on close.
 *
 * Identical copies: frontend/src/hooks/useModalDialog.ts and landing-page/src/hooks/useModalDialog.ts
 * (the cookie banner uses it in both packages). Elements marked `data-dialog-keep` (toasts) stay active.
 */
export interface ModalDialogOptions {
  /** Escape (and the caller's backdrop) close the dialog through this callback. */
  onClose: () => void
  /** false while closing is not allowed (e.g. a running batch) – Escape does nothing. */
  dismissible?: boolean
  /** Focused on open; default: the first focusable element, else the dialog itself. */
  initialFocus?: RefObject<HTMLElement | null>
  /** Lets a component keep the hook mounted while its dialog is closed (cookie banner). Default true. */
  active?: boolean
  /** Fallback target on close when the opener is gone (e.g. it was re-rendered). */
  returnFocus?: () => HTMLElement | null | undefined
}

interface Entry {
  dialog: HTMLElement
  opener: HTMLElement | null
  onEscape: () => void
}

const KEEP_ATTRIBUTE = 'data-dialog-keep'
const ROOT_ATTRIBUTE = 'data-dialog-root'
const NON_CONTENT = new Set(['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE', 'NOSCRIPT'])
const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(',')

const stack: Entry[] = []
let inerted: Element[] = []

const top = () => stack[stack.length - 1]

/** jsdom has no layout – there every element counts as rendered. */
const hasLayout = () => typeof document !== 'undefined' && document.documentElement.getClientRects().length > 0

function isRendered(el: HTMLElement): boolean {
  if (el.closest('[hidden], [inert]')) return false
  if (hasLayout() && el.getClientRects().length === 0) return false
  return getComputedStyle(el).visibility !== 'hidden'
}

/** Elements Tab can reach inside `root`, in DOM order; a radio group is one stop (checked, else first). */
export function tabbableElements(root: HTMLElement): HTMLElement[] {
  const all = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.tabIndex >= 0 && isRendered(el))
  return all.filter((el) => {
    if (!(el instanceof HTMLInputElement) || el.type !== 'radio' || !el.name) return true
    const group = all.filter((other): other is HTMLInputElement => other instanceof HTMLInputElement && other.type === 'radio' && other.name === el.name)
    const checked = group.find((radio) => radio.checked)
    return checked ? checked === el : group[0] === el
  })
}

/** Everything except the top dialog (and kept elements) becomes inert; called on every stack change. */
function applyInert() {
  for (const el of inerted) el.removeAttribute('inert')
  inerted = []
  const entry = top()
  if (!entry) return
  let node: Element = entry.dialog.closest(`[${ROOT_ATTRIBUTE}]`) ?? entry.dialog
  while (node.parentElement && node !== document.body) {
    const parent: Element = node.parentElement
    for (const sibling of Array.from(parent.children)) {
      if (sibling === node || NON_CONTENT.has(sibling.tagName) || sibling.hasAttribute('inert') || sibling.hasAttribute(KEEP_ATTRIBUTE)) continue
      sibling.setAttribute('inert', '')
      inerted.push(sibling)
    }
    node = parent
  }
}

function onKeyDown(event: KeyboardEvent) {
  const entry = top()
  if (!entry || event.defaultPrevented) return
  if (event.key === 'Escape') {
    event.preventDefault()
    entry.onEscape()
    return
  }
  if (event.key !== 'Tab') return
  // Tab is fully managed: the same order in every engine (Safari skips buttons natively) and it never leaves.
  event.preventDefault()
  const items = tabbableElements(entry.dialog)
  if (!items.length) {
    entry.dialog.focus()
    return
  }
  const step = event.shiftKey ? -1 : 1
  const active = document.activeElement
  let index = active instanceof HTMLElement ? items.indexOf(active) : -1
  if (index === -1) {
    // Not a tab stop (the dialog itself, an unchecked radio, something outside): continue from its position.
    const inside = active instanceof Node && entry.dialog.contains(active)
    const following = inside ? items.findIndex((el) => Boolean(active!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) : 0
    const next = following === -1 ? items.length : following
    index = step === 1 ? next - 1 : next
  }
  items[(index + step + items.length) % items.length].focus()
}

/** Safari does not focus a clicked button – the last pointer target stands in for the opener. */
let lastPointerTarget: { element: Element; at: number } | null = null
function onPointerDown(event: PointerEvent) {
  if (event.target instanceof Element) lastPointerTarget = { element: event.target, at: Date.now() }
}
if (typeof document !== 'undefined') document.addEventListener('pointerdown', onPointerDown, true)

function openerOf(active: Element | null): HTMLElement | null {
  const recent = lastPointerTarget && Date.now() - lastPointerTarget.at < 5000 ? lastPointerTarget.element : null
  const found = recent?.closest<HTMLElement>(FOCUSABLE)
  const clicked = found && found.isConnected && found.tabIndex >= 0 ? found : null
  if (active instanceof HTMLElement && active !== document.body) {
    // Safari focuses the nearest focusable container (e.g. a dialog panel) instead of the clicked button.
    return clicked && active.tabIndex < 0 && active.contains(clicked) ? clicked : active
  }
  return clicked
}

/** Focus that lands outside the top dialog (and outside kept elements) is pulled back in. */
function onFocusIn(event: FocusEvent) {
  const entry = top()
  const target = event.target
  if (!entry || !(target instanceof Element) || entry.dialog.contains(target) || target.closest(`[${KEEP_ATTRIBUTE}]`)) return
  ;(tabbableElements(entry.dialog)[0] ?? entry.dialog).focus()
}

function push(entry: Entry) {
  if (!stack.length) {
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)
  }
  stack.push(entry)
  applyInert()
}

/** Removes a dialog; returns true when it was the top one (only then focus goes back to its opener). */
function remove(entry: Entry): boolean {
  const index = stack.indexOf(entry)
  if (index === -1) return false
  const wasTop = index === stack.length - 1
  // A dialog opened from inside this one inherits its opener – its own opener disappears with it.
  for (const above of stack.slice(index + 1)) {
    if (!above.opener || entry.dialog.contains(above.opener) || !above.opener.isConnected) above.opener = entry.opener
  }
  stack.splice(index, 1)
  applyInert()
  if (!stack.length) {
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('focusin', onFocusIn)
  }
  return wasTop
}

const focusable = (el: HTMLElement | null | undefined): el is HTMLElement => Boolean(el && el.isConnected && el !== document.body && !el.closest('[inert]'))

/** Returns the ref for the element with role="dialog" (its `data-dialog-root` ancestor, if any, stays active). */
export function useModalDialog<T extends HTMLElement = HTMLDivElement>({ onClose, dismissible = true, initialFocus, active = true, returnFocus }: ModalDialogOptions): RefObject<T> {
  const dialogRef = useRef<T>(null)
  const latest = useRef({ onClose, dismissible, returnFocus })
  latest.current = { onClose, dismissible, returnFocus }

  useEffect(() => {
    const dialog = dialogRef.current
    if (!active || !dialog) return
    const opener = openerOf(document.activeElement)
    const entry: Entry = {
      dialog,
      opener,
      onEscape: () => {
        if (latest.current.dismissible) latest.current.onClose()
      },
    }
    push(entry)
    ;(initialFocus?.current ?? tabbableElements(dialog)[0] ?? dialog).focus()
    return () => {
      if (!remove(entry)) return
      const target = focusable(entry.opener) ? entry.opener : latest.current.returnFocus?.()
      if (focusable(target)) target.focus()
    }
    // The dialog opens once per activation; option changes are read through `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return dialogRef
}
