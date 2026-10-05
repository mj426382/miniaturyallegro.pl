import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { authApi, usersApi, setUnauthorizedHandler } from '../services/api'
import { queryClient } from '../lib/queryClient'
import { setReportingUser } from '../services/errorReporting'
import { clearSessionToken, loadSessionToken, setSessionToken } from '../platform/sessionToken'
import { isNativeApp, onAppResume } from '../platform/native'

interface User {
  id: string
  email: string
  name?: string
  credits: number
  freeCreditsUsed: number
  totalGenerations?: number
  /** False for Google-only accounts (no password set). */
  hasPassword?: boolean
  /** Spec 13: unconfirmed accounts cannot generate or pay. Older API responses omit it (treated as confirmed). */
  emailVerified?: boolean
  /** Spec 16: tips and reminders by e-mail (opt-in) and the "batch finished" e-mail. */
  marketingConsent?: boolean
  notifyBatchDone?: boolean
  /** Spec 16: address listed in ADMIN_EMAILS. */
  isAdmin?: boolean
  _count?: { images: number }
  createdAt: string
}

interface AuthContextType {
  user: User | null
  /** @deprecated the session is an httpOnly cookie – kept for components that only check truthiness */
  token: string | null
  login: (email: string, password: string) => Promise<void>
  googleLogin: (googleToken: string, acceptedTerms?: boolean) => Promise<void>
  register: (email: string, password: string, name: string | undefined, acceptedTerms: boolean, marketingConsent?: boolean) => Promise<void>
  logout: () => void
  /** Re-fetches the profile (credits, counters) from the API. */
  refreshUser: () => Promise<void>
  isLoading: boolean
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

// Legacy sessions stored the JWT in localStorage – wipe it so it can never be read by a script again.
function clearLegacyStorage() {
  try {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  } catch {
    // storage may be unavailable (private mode)
  }
}

export function useAuthProvider() {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const { data } = await usersApi.getMe()
    setUser(data)
    setToken('cookie')
  }, [])

  // Session bootstrap: the cookie is httpOnly, so the only way to know whether we are
  // logged in is to ask the API. 401 here simply means "not logged in".
  useEffect(() => {
    clearLegacyStorage()
    let cancelled = false
    // Native apps first restore their Bearer token (spec 18); on the web this resolves immediately.
    loadSessionToken()
      .catch(() => null)
      .then(() => refreshUser())
      .catch(() => {
        if (!cancelled) {
          setToken(null)
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refreshUser])

  // Spec 18, AC-MOB-005: back in the foreground (e.g. after paying or confirming the e-mail in the
  // browser) the app re-reads credits and the verification status.
  useEffect(() => {
    if (!user || !isNativeApp()) return
    let unsubscribe: (() => void) | null = null
    let active = true
    onAppResume(() => {
      refreshUser().catch(() => undefined)
    })
      .then((off) => {
        if (active) unsubscribe = off
        else off()
      })
      .catch(() => undefined)
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [user, refreshUser])

  // Once logged in, any later 401 (expired cookie, password reset elsewhere) drops the session and
  // sends the user to /login. The handler is armed ONLY for an authenticated session – otherwise the
  // bootstrap 401 of an anonymous visitor would bounce /register and /reset-password to /login.
  useEffect(() => {
    if (!user) {
      setUnauthorizedHandler(null)
      return
    }
    setReportingUser({ id: user.id })
    setUnauthorizedHandler(() => {
      queryClient.clear()
      setReportingUser(null)
      clearSessionToken().catch(() => undefined)
      setToken(null)
      setUser(null)
      if (window.location.pathname !== '/login') window.location.href = '/login'
    })
    return () => setUnauthorizedHandler(null)
  }, [user])

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login({ email, password })
    await setSessionToken(data.token)
    setToken('cookie')
    setUser(data.user)
    refreshUser().catch(() => undefined)
  }

  const googleLogin = async (googleToken: string, acceptedTerms?: boolean) => {
    const { data } = await authApi.googleLogin(googleToken, acceptedTerms)
    await setSessionToken(data.token)
    setToken('cookie')
    setUser(data.user)
    refreshUser().catch(() => undefined)
  }

  const register = async (email: string, password: string, name: string | undefined, acceptedTerms: boolean, marketingConsent = false) => {
    const { data } = await authApi.register({ email, password, name, acceptedTerms, marketingConsent })
    await setSessionToken(data.token)
    setToken('cookie')
    setUser(data.user)
    refreshUser().catch(() => undefined)
  }

  const logout = () => {
    // The request still carries the native Bearer token; it is dropped once the API has answered.
    authApi
      .logout()
      .catch(() => undefined)
      .finally(() => clearSessionToken().catch(() => undefined))
    // Cached server state belongs to the previous session – never show it to the next user.
    queryClient.clear()
    setReportingUser(null)
    setToken(null)
    setUser(null)
  }

  return { user, token, login, googleLogin, register, logout, refreshUser, isLoading }
}
