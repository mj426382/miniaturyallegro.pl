import { Link } from 'react-router-dom'
import RegulaminContent from '../legal/RegulaminContent'

export default function Regulamin() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <Link to="/" className="text-sm text-blue-600 hover:underline">
        ← Wróć do aplikacji
      </Link>
      <div className="mt-6">
        <RegulaminContent />
      </div>
    </div>
  )
}
