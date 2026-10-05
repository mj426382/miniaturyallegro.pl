import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'

/**
 * Spec 18: behaviour of the Android/iOS app (Capacitor) versus the web. The Capacitor runtime and
 * plugins are replaced by in-memory fakes; the app code under test is the real one.
 */
const fake = vi.hoisted(() => ({
  native: false,
  prefs: new Map<string, string>(),
  browserOpen: vi.fn(async (opts: { url: string }) => void opts),
  shared: [] as Array<{ title?: string; files?: string[] }>,
  written: [] as Array<{ path: string; data: string; directory: string }>,
  resume: [] as Array<() => void>,
}))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => fake.native } }))
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: fake.prefs.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => void fake.prefs.set(key, value),
    remove: async ({ key }: { key: string }) => void fake.prefs.delete(key),
  },
}))
vi.mock('@capacitor/browser', () => ({ Browser: { open: fake.browserOpen } }))
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: {
    writeFile: async (opts: { path: string; data: string; directory: string }) => {
      fake.written.push(opts)
      return { uri: `file:///cache/${opts.path}` }
    },
  },
}))
vi.mock('@capacitor/share', () => ({ Share: { share: async (opts: { title?: string; files?: string[] }) => void fake.shared.push(opts) } }))
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: async (_event: string, cb: () => void) => {
      fake.resume.push(cb)
      return { remove: async () => undefined }
    },
  },
}))

import api from '../services/api'
import { clearSessionToken, getSessionToken, setSessionToken } from './sessionToken'
import { AuthContext, useAuthProvider } from '../hooks/useAuth'
import { downloadBlob } from '../utils/download'
import Credits from '../pages/Credits'

const last = () => requests[requests.length - 1]
type Handler = (config: InternalAxiosRequestConfig) => { status: number; data: unknown }
let requests: InternalAxiosRequestConfig[] = []
let handler: Handler = () => ({ status: 200, data: {} })

beforeEach(() => {
  fake.native = false
  fake.prefs.clear()
  fake.browserOpen.mockClear()
  fake.shared.length = 0
  fake.written.length = 0
  fake.resume.length = 0
  requests = []
  handler = () => ({ status: 200, data: {} })
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    requests.push(config)
    const { status, data } = handler(config)
    const response = { data, status, statusText: String(status), headers: {}, config }
    if (status >= 400) throw Object.assign(new Error(`HTTP ${status}`), { response, config, isAxiosError: true })
    return response
  }
})

afterEach(async () => {
  cleanup()
  fake.native = true
  await clearSessionToken()
  fake.native = false
  vi.unstubAllEnvs()
})

const authHeader = (config: AxiosRequestConfig) => (config.headers as Record<string, unknown> | undefined)?.Authorization

const USER = { id: 'u1', email: 'a@b.pl', credits: 3, freeCreditsUsed: 2, emailVerified: true, createdAt: '2026-10-01T00:00:00.000Z' }

describe('session transport', () => {
  it('[AC-MOB-001] the native app stores the login token, sends it as Bearer and drops it on 401', async () => {
    fake.native = true
    let loggedIn = false
    handler = (config) => {
      if (config.url === '/auth/login') {
        loggedIn = true
        return { status: 200, data: { user: USER, token: 'jwt-from-login' } }
      }
      if (config.url === '/users/me') return loggedIn ? { status: 200, data: USER } : { status: 401, data: {} }
      return { status: 200, data: {} }
    }
    const { result } = renderHook(() => useAuthProvider())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(() => result.current.login('a@b.pl', 'Dobre!Haslo1'))
    expect(fake.prefs.get('allgrafika.session')).toBe('jwt-from-login')
    await api.get('/images')
    expect(authHeader(last())).toBe('Bearer jwt-from-login')

    // Expired session: the next 401 clears the stored token.
    handler = (config) => (config.url === '/images' ? { status: 401, data: {} } : { status: 200, data: USER })
    await api.get('/images').catch(() => undefined)
    await waitFor(() => expect(fake.prefs.has('allgrafika.session')).toBe(false))
    expect(getSessionToken()).toBeNull()
  })

  it('[AC-MOB-001] logging out in the app sends the token once more, then forgets it', async () => {
    fake.native = true
    fake.prefs.set('allgrafika.session', 'stored-jwt')
    handler = () => ({ status: 200, data: USER })
    const { result } = renderHook(() => useAuthProvider())
    await waitFor(() => expect(result.current.user?.id).toBe('u1'))
    expect(authHeader(requests.find((r) => r.url === '/users/me')!)).toBe('Bearer stored-jwt')

    act(() => result.current.logout())
    await waitFor(() => expect(fake.prefs.has('allgrafika.session')).toBe(false))
    expect(authHeader(requests.find((r) => r.url === '/auth/logout')!)).toBe('Bearer stored-jwt')
  })

  it('[AC-MOB-002] the web never sends an Authorization header and keeps the cookie session', async () => {
    await setSessionToken('should-be-ignored')
    expect(fake.prefs.size).toBe(0)
    await api.get('/users/me')
    expect(authHeader(last())).toBeUndefined()
    expect(last().withCredentials).toBe(true)
    expect((last().headers as Record<string, unknown>)['X-Requested-With']).toBe('XMLHttpRequest')
  })
})

describe('app lifecycle', () => {
  it('[AC-MOB-005] returning to the foreground refreshes the account', async () => {
    fake.native = true
    fake.prefs.set('allgrafika.session', 'stored-jwt')
    let credits = 3
    handler = () => ({ status: 200, data: { ...USER, credits } })
    const { result } = renderHook(() => useAuthProvider())
    await waitFor(() => expect(result.current.user?.credits).toBe(3))
    await waitFor(() => expect(fake.resume.length).toBeGreaterThan(0))

    credits = 18 // bought on the web in the meantime
    act(() => fake.resume.forEach((cb) => cb()))
    await waitFor(() => expect(result.current.user?.credits).toBe(18))
  })
})

describe('downloads', () => {
  it('[AC-MOB-004] the app hands the image to the native share sheet', async () => {
    fake.native = true
    const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' })
    const method = await downloadBlob(blob, 'allgrafika biały kubek.png')
    expect(method).toBe('share')
    expect(fake.written).toHaveLength(1)
    expect(fake.written[0]).toMatchObject({ path: 'allgrafika-biały-kubek.png', directory: 'CACHE' })
    expect(fake.written[0].data).toBe('iVBORw==')
    expect(fake.shared).toEqual([{ title: 'allgrafika-biały-kubek.png', files: ['file:///cache/allgrafika-biały-kubek.png'] }])
  })
})

describe('purchases', () => {
  const PACKAGES = [{ id: 'credits_15', credits: 15, priceGrosze: 2900, label: '15 kredytów', priceLabel: '29 zł', savingLabel: null }]
  const PLANS = [{ id: 'start', name: 'Start', priceLabel: '39 zł / mies.', description: '30 kredytów', available: true }]

  function renderCredits() {
    handler = (config) => {
      const url = config.url
      if (url === '/payments/packages') return { status: 200, data: PACKAGES }
      if (url === '/payments/plans') return { status: 200, data: PLANS }
      if (url === '/payments/subscription') return { status: 200, data: { subscription: null } }
      if (url === '/payments/history') return { status: 200, data: [] }
      if (url === '/users/me') return { status: 200, data: USER }
      return { status: 200, data: { url: 'https://checkout.stripe.com/x' } }
    }
    const auth = { user: USER, token: 'cookie', isLoading: false, refreshUser: async () => undefined } as unknown as ReturnType<typeof useAuthProvider>
    return render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AuthContext.Provider value={auth}>
          <MemoryRouter initialEntries={['/credits']}>
            <Credits />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    )
  }

  it('[AC-MOB-003] in the app, buying a package or a plan opens the web credits page instead of Stripe', async () => {
    fake.native = true
    renderCredits()
    await userEvent.click(await screen.findByRole('button', { name: 'Kup 15 kredytów' }))
    await userEvent.click(screen.getByRole('button', { name: 'Wybierz plan Start' }))
    expect(fake.browserOpen.mock.calls.map(([o]) => o.url)).toEqual(['https://app.allgrafika.pl/credits', 'https://app.allgrafika.pl/credits'])
    expect(requests.some((r) => r.url?.startsWith('/payments/checkout') || r.url?.startsWith('/payments/subscribe'))).toBe(false)
    expect(screen.getByRole('note')).toHaveTextContent('przycisk otworzy przeglądarkę')
    // The consumer-law consent is collected on the web checkout, not in the app.
    expect(screen.queryByText(/Żądam natychmiastowego udostępnienia kredytów/)).toBeNull()
  })

  it('[AC-MOB-003] the "hidden" build shows the balance but no purchase buttons', async () => {
    fake.native = true
    vi.stubEnv('VITE_NATIVE_PURCHASES', 'hidden')
    renderCredits()
    expect(await screen.findByRole('heading', { name: 'Kredyty' })).toBeInTheDocument()
    await waitFor(() => expect(requests.some((r) => r.url === '/payments/packages')).toBe(true))
    expect(screen.queryByRole('button', { name: /^Kup / })).toBeNull()
    expect(screen.queryByRole('button', { name: /Wybierz plan/ })).toBeNull()
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('[AC-MOB-003] on the web the purchase still goes to Stripe checkout', async () => {
    renderCredits()
    await userEvent.click(await screen.findByText(/Żądam natychmiastowego udostępnienia kredytów/))
    const assign = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...original,
        set href(v: string) {
          assign(v)
        },
      },
    })
    try {
      await userEvent.click(screen.getByRole('button', { name: 'Kup 15 kredytów' }))
      await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe.com/x'))
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original })
    }
    expect(fake.browserOpen).not.toHaveBeenCalled()
  })
})

describe('features that need the web', () => {
  const auth = { user: null, token: null, isLoading: false, login: async () => undefined, googleLogin: async () => undefined } as unknown as ReturnType<typeof useAuthProvider>

  async function renderLogin() {
    const { default: Login } = await import('../pages/Login')
    return render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/login']}>
          <Login />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
  }

  it('[AC-MOB-006] the app hides Google sign-in (and its divider); the web keeps it', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com')
    fake.native = true
    const app = await renderLogin()
    expect(screen.getByRole('heading', { name: 'Zaloguj się' })).toBeInTheDocument()
    expect(screen.queryByText('lub')).toBeNull()
    app.unmount()

    fake.native = false
    await renderLogin()
    expect(screen.getByText('lub')).toBeInTheDocument()
  })

  it('[AC-MOB-006] connecting Allegro in the app opens the web page in the browser', async () => {
    fake.native = true
    handler = (config) => (config.url === '/allegro/status' ? { status: 200, data: { configured: true, connected: false, sellerLogin: null } } : { status: 200, data: {} })
    const { default: Allegro } = await import('../pages/Allegro')
    const { ConfirmProvider } = await import('../components/ConfirmDialog')
    render(
      <ConfirmProvider>
        <MemoryRouter initialEntries={['/allegro']}>
          <Allegro />
        </MemoryRouter>
      </ConfirmProvider>,
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Połącz z Allegro' }))
    expect(fake.browserOpen).toHaveBeenCalledWith({ url: 'https://app.allgrafika.pl/allegro' })
    expect(requests.some((r) => r.url === '/allegro/auth-url')).toBe(false)
  })
})
