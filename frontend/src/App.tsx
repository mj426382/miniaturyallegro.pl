import { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import CookieBanner from './consent/CookieBanner'
import PageViewTracker from './consent/PageViewTracker'
import { AuthContext, useAuthProvider } from './hooks/useAuth'
import ScrollToTop from './components/ScrollToTop'
import Login from './pages/Login'
import Register from './pages/Register'
import Layout from './components/Layout'
import PageFallback from './components/PageFallback'
import { lazyPage } from './utils/lazyPage'
import ErrorBoundary from './components/ErrorBoundary'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { ConfirmProvider } from './components/ConfirmDialog'

// Login and registration stay in the entry chunk (first screen for new visitors); everything else
// is split per route (spec 17, AC-PERF-003).
const ForgotPassword = lazyPage(() => import('./pages/ForgotPassword'))
const Dashboard = lazyPage(() => import('./pages/Dashboard'))
const Upload = lazyPage(() => import('./pages/Upload'))
const BulkUpload = lazyPage(() => import('./pages/BulkUpload'))
const Generate = lazyPage(() => import('./pages/Generate'))
const Gallery = lazyPage(() => import('./pages/Gallery'))
const Credits = lazyPage(() => import('./pages/Credits'))
const Account = lazyPage(() => import('./pages/Account'))
const ResetPassword = lazyPage(() => import('./pages/ResetPassword'))
const VerifyEmail = lazyPage(() => import('./pages/VerifyEmail'))
const Unsubscribe = lazyPage(() => import('./pages/Unsubscribe'))
const Admin = lazyPage(() => import('./pages/Admin'))
const Regulamin = lazyPage(() => import('./pages/Regulamin'))
const PolitykaPrywatnosci = lazyPage(() => import('./pages/PolitykaPrywatnosci'))
const NotFound = lazyPage(() => import('./pages/NotFound'))

/** Spec 03, AC-AUTH-027: the address the visitor wanted is kept, so login brings them back to it. */
function PrivateRoute({ children, isAuthenticated }: { children: React.ReactNode; isAuthenticated: boolean }) {
  const location = useLocation()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
}

export default function App() {
  const auth = useAuthProvider()

  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={auth}>
          <ConfirmProvider>
            <BrowserRouter>
              <ScrollToTop />
              <PageViewTracker />
              <Suspense fallback={<PageFallback fullScreen />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/verify-email" element={<VerifyEmail />} />
                  <Route path="/unsubscribe" element={<Unsubscribe />} />
                  <Route path="/regulamin" element={<Regulamin />} />
                  <Route path="/polityka-prywatnosci" element={<PolitykaPrywatnosci />} />
                  <Route
                    path="/"
                    element={
                      <PrivateRoute isAuthenticated={Boolean(auth.user)}>
                        <Layout />
                      </PrivateRoute>
                    }
                  >
                    <Route index element={<Dashboard />} />
                    <Route path="upload" element={<Upload />} />
                    <Route path="bulk-upload" element={<BulkUpload />} />
                    <Route path="generate/:imageId" element={<Generate />} />
                    <Route path="gallery" element={<Gallery />} />
                    <Route path="credits" element={<Credits />} />
                    <Route path="account" element={<Account />} />
                    <Route path="admin" element={auth.user?.isAdmin ? <Admin /> : <Navigate to="/" replace />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </Suspense>
              <CookieBanner />
            </BrowserRouter>
          </ConfirmProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
