import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { allegroApi } from '../services/api'
import { track } from '../services/analytics'

/** Allegro redirects here with ?code=...&state=... after the seller approves access. */
export default function AllegroCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    const code = params.get('code')
    const state = params.get('state')
    if (!code || !state) {
      setError(params.get('error_description') || 'Allegro nie przekazało kodu autoryzacji.')
      return
    }
    allegroApi
      .callback(code, state)
      .then(() => {
        track('allegro_connected')
        navigate('/allegro', { replace: true })
      })
      .catch((err) => {
        const message = err.response?.data?.message
        setError(Array.isArray(message) ? message.join('. ') : message || 'Nie udało się połączyć konta Allegro.')
      })
  }, [params, navigate])

  return (
    <div className="p-8 max-w-md mx-auto text-center">
      {error ? (
        <>
          <p className="text-red-600 font-medium">{error}</p>
          <Link to="/allegro" className="btn-primary inline-block mt-6">
            Spróbuj ponownie
          </Link>
        </>
      ) : (
        <>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Łączę konto Allegro...</p>
        </>
      )}
    </div>
  )
}
