import { useState } from 'react'
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  HomeIcon,
  ArrowUpTrayIcon,
  Squares2X2Icon,
  ArrowRightOnRectangleIcon,
  RectangleStackIcon,
  CreditCardIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Prześlij zdjęcie', href: '/upload', icon: ArrowUpTrayIcon },
  { name: 'Masowe przesyłanie', href: '/bulk-upload', icon: RectangleStackIcon },
  { name: 'Galeria', href: '/gallery', icon: Squares2X2Icon },
  { name: 'Kredyty', href: '/credits', icon: CreditCardIcon },
]

const FREE_LIMIT = 10

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const closeSidebar = () => setSidebarOpen(false)

  const sidebarContent = (
    <>
      <div className="p-6 border-b border-gray-200 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-gray-900" onClick={closeSidebar}>
          <img src="/logo.webp" alt="AllGrafika.pl" className="h-9 w-auto mix-blend-multiply" />
          <span>AllGrafika.pl</span>
        </Link>
        <button
          onClick={closeSidebar}
          className="lg:hidden p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={closeSidebar}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        {user && (
          <Link to="/credits" onClick={closeSidebar} className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
            <CreditCardIcon className="h-4 w-4 text-blue-600 shrink-0" />
            <div className="flex-1 min-w-0">
              {(user.freeCreditsUsed ?? 0) < FREE_LIMIT ? (
                <p className="text-xs text-blue-700 font-medium">
                  Darmowe: {FREE_LIMIT - (user.freeCreditsUsed ?? 0)} / {FREE_LIMIT}
                </p>
              ) : (
                <p className="text-xs text-blue-700 font-medium">
                  Kredyty: <span className="font-bold">{user.credits ?? 0}</span>
                </p>
              )}
            </div>
          </Link>
        )}

        <div className="flex items-center gap-3 mb-3">
          <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
            <span className="text-blue-700 font-semibold text-sm">
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.name || 'Użytkownik'}
            </p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 w-full px-2 py-1.5 rounded hover:bg-gray-50 transition-colors"
        >
          <ArrowRightOnRectangleIcon className="h-4 w-4" />
          Wyloguj się
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Mobile sidebar (slide-in) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transform transition-transform duration-200 ease-in-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar (always visible) */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-gray-200 flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.webp" alt="AllGrafika.pl" className="h-7 w-auto mix-blend-multiply" />
            <span className="font-bold text-gray-900">AllGrafika.pl</span>
          </Link>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
