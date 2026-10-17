import { useState } from 'react'
import toast from 'react-hot-toast'
import { authApi } from '../services/api'
import { useAuth } from './useAuth'

/** Spec 13: „Wyślij link ponownie” – shared by the verification banner and the upload-limit alert (spec 11). */
export function useResendVerification() {
  const { refreshUser } = useAuth()
  const [sending, setSending] = useState(false)

  const resend = async () => {
    setSending(true)
    try {
      const { data } = await authApi.resendVerification()
      if (data.alreadyVerified) {
        toast.success('Adres jest już potwierdzony.')
        refreshUser().catch(() => undefined)
      } else {
        toast.success('Wysłaliśmy nowy link. Sprawdź skrzynkę, także folder spam.')
      }
    } catch (err: any) {
      const message = err.response?.data?.message
      toast.error(Array.isArray(message) ? message.join('. ') : message || 'Nie udało się wysłać linku')
    } finally {
      setSending(false)
    }
  }

  return { resend, sending }
}
