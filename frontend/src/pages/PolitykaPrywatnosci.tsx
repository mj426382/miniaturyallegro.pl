import { Link } from 'react-router-dom'
import PolitykaContent from '../legal/PolitykaContent'
import { usePageTitle } from '../hooks/usePageTitle'

export default function PolitykaPrywatnosci() {
  usePageTitle('Polityka prywatności')
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        ← Wróć do aplikacji
      </Link>
      <div className="mt-6">
        <PolitykaContent />
      </div>
    </div>
  )
}
