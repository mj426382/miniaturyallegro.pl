import { Link } from 'react-router-dom'
import { usePageTitle } from '../hooks/usePageTitle'

export default function NotFound() {
  usePageTitle('Nie znaleziono strony')
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <p className="text-6xl font-extrabold text-blue-600 mb-2">404</p>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Tej strony nie ma</h1>
        <p className="text-sm text-gray-500 mb-6">Adres jest nieprawidłowy albo strona została przeniesiona.</p>
        <Link to="/" className="btn-primary">
          Wróć na dashboard
        </Link>
      </div>
    </div>
  )
}
