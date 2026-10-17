/** Spec 17: shown while the lazily loaded chunk of a dialog arrives (usually only on a slow first open). */
export default function ModalFallback() {
  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center" role="status" aria-label="Ładowanie okna">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white" />
    </div>
  )
}
