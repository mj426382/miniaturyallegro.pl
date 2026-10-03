import { useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'

const PHONE_QUERY = '(max-width: 767px)'

/** Phones get notifications at the bottom – at the top they cover the header and the menu button. */
export default function AppToaster() {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches)
  useEffect(() => {
    const query = window.matchMedia(PHONE_QUERY)
    const onChange = (e: MediaQueryListEvent) => setPhone(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return <Toaster position={phone ? 'bottom-center' : 'top-right'} containerStyle={phone ? { bottom: 24 } : undefined} />
}
