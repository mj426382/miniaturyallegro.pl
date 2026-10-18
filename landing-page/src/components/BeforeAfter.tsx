import { useState } from 'react'
import type { SamplePair } from '../data/samples'

/** Draggable before/after comparison – pure CSS clip, works without JS for the "after" image. */
function Slider({ pair, sizes }: { pair: SamplePair; sizes: string }) {
  const [position, setPosition] = useState(50)
  return (
    <figure className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="relative aspect-square select-none">
        <img
          src={pair.after}
          srcSet={pair.afterSrcSet}
          sizes={sizes}
          width={800}
          height={800}
          alt={`${pair.title}: zdjęcie produktowe AI${pair.style ? ` w stylu „${pair.style}”` : ''} wygenerowane w AllGrafika`}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
        <img
          src={pair.before}
          srcSet={pair.beforeSrcSet}
          sizes={sizes}
          width={800}
          height={800}
          alt={`${pair.title}: oryginalne zdjęcie z telefonu`}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          loading="lazy"
        />
        <div className="absolute inset-y-0 w-0.5 bg-white shadow pointer-events-none" style={{ left: `${position}%` }} />
        <span className="absolute top-3 left-3 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">przed</span>
        <span className="absolute top-3 right-3 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">po</span>
        <input
          type="range"
          min={0}
          max={100}
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          aria-label="Porównaj przed i po"
          className="absolute inset-x-0 bottom-3 mx-auto w-[85%] accent-blue-600 cursor-ew-resize"
        />
      </div>
      <figcaption className="px-4 py-3 text-sm text-gray-700 flex items-center justify-between gap-2">
        <span className="truncate">{pair.title}</span>
        {pair.style && <span className="text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">{pair.style}</span>}
      </figcaption>
    </figure>
  )
}

export default function BeforeAfter({ pairs }: { pairs: SamplePair[] }) {
  if (!pairs.length) return null
  const fourColumns = pairs.length % 4 === 0
  // AC-PERF-008: card width per breakpoint (max-w-6xl, px-4/sm:px-6, gap-6) so phones and desktops get the 400/700 px variants.
  const sizes = `(min-width: 1024px) ${fourColumns ? '260px' : '352px'}, (min-width: 640px) calc(50vw - 36px), calc(100vw - 32px)`
  return (
    <section id="przed-po" className="py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            Zdjęcie z telefonu <span className="text-blue-600">→ zdjęcie produktowe</span>
          </h2>
          <p className="text-gray-600 mt-4 text-lg">Prawdziwe przykłady wygenerowane w AllGrafika. Przesuń suwak, aby porównać.</p>
        </div>
        {/* 4 or 8 pairs fill four columns; otherwise three, so no card is left alone in a row. */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${fourColumns ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6`}>
          {pairs.map((pair) => (
            <Slider key={pair.id} pair={pair} sizes={sizes} />
          ))}
        </div>
      </div>
    </section>
  )
}
