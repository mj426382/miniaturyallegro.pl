import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthContext, useAuthProvider } from './hooks/useAuth'
import ScrollToTop from './components/ScrollToTop'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import BulkUpload from './pages/BulkUpload'
import Generate from './pages/Generate'
import Gallery from './pages/Gallery'
import Credits from './pages/Credits'
import Account from './pages/Account'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import Allegro from './pages/Allegro'
import AllegroCallback from './pages/AllegroCallback'
import Layout from './components/Layout'
import Regulamin from './pages/Regulamin'
import PolitykaPrywatnosci from './pages/PolitykaPrywatnosci'
import NotFound from './pages/NotFound'
import ErrorBoundary from './components/ErrorBoundary'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { ConfirmProvider } from './components/ConfirmDialog'

function PrivateRoute({ children, isAuthenticated }: { children: React.ReactNode; isAuthenticated: boolean }) {
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
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
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
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
                  <Route path="allegro" element={<Allegro />} />
                  <Route path="allegro/callback" element={<AllegroCallback />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </ConfirmProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
