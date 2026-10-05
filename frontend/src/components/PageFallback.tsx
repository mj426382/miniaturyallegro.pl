/** Shown while a route chunk loads (spec 17). Reserves space so the layout does not jump. */
export default function PageFallback({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div role="status" aria-label="Ładowanie" className={`flex items-center justify-center ${fullScreen ? 'min-h-screen' : 'min-h-[50vh]'}`}>
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  )
}
