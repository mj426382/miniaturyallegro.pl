import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthContext, useAuthProvider } from './hooks/useAuth'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import BulkUpload from './pages/BulkUpload'
import Generate from './pages/Generate'
import Gallery from './pages/Gallery'
import Layout from './components/Layout'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  return token ? <>{children}</> : <Navigate to="/login" replace />
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
    <AuthContext.Provider value={auth}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="upload" element={<Upload />} />
            <Route path="bulk-upload" element={<BulkUpload />} />
            <Route path="generate/:imageId" element={<Generate />} />
            <Route path="gallery" element={<Gallery />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
