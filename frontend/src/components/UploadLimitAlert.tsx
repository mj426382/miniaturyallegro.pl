import FormAlert from './FormAlert'
import { useResendVerification } from '../hooks/useResendVerification'
import type { UploadLimitError } from '../utils/uploadLimits'

interface Props {
  error: UploadLimitError
  /** Bulk upload keeps the refused photo and the rest queued – the hint says how to continue. */
  bulk?: boolean
}

/** Spec 11 §5a, AC-UI-014: an upload limit is explained next to the form (the API's message), with the next step. */
export default function UploadLimitAlert({ error, bulk = false }: Props) {
  const { resend, sending } = useResendVerification()
  return (
    <FormAlert className="mb-4">
      <strong className="block" data-testid="upload-limit-title">
        {error.title}
      </strong>
      <span className="block mt-0.5">{error.message}</span>
      {error.retryHint && (
        <span className="block mt-0.5 font-medium" data-testid="upload-limit-retry">
          {error.retryHint}
        </span>
      )}
      {bulk && <span className="block mt-0.5">Przesłane zdjęcia zostają. Pozostałe czekają na liście – kliknij „Prześlij”, gdy limit pozwoli na kolejne.</span>}
      {error.kind === 'unverified' && (
        <button type="button" onClick={resend} disabled={sending} className="btn-secondary text-sm mt-2">
          {sending ? 'Wysyłam...' : 'Wyślij link ponownie'}
        </button>
      )}
    </FormAlert>
  )
}
