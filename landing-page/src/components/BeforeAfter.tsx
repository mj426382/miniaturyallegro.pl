import { useState } from 'react'
import type { SamplePair } from '../data/samples'

/** Draggable before/after comparison – pure CSS clip, works without JS for the "after" image. */
function Slider({ pair }: { pair: SamplePair }) {
  const [position, setPosition] = useState(50)
  return (
    <figure className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="relative aspect-square select-none">
        <img src={pair.after} alt={`${pair.title} – po`} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        <img src={pair.before} alt={`${pair.title} – przed`} className="absolute inset-0 w-full h-full object-cover" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }} loading="lazy" />
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
  return (
    <section id="przed-po" className="py-20 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            Zdjęcie z telefonu <span className="text-blue-600">→ miniaturka Allegro</span>
          </h2>
          <p className="text-gray-500 mt-4 text-lg">Prawdziwe przykłady wygenerowane w AllGrafika. Przesuń suwak, aby porównać.</p>
        </div>
        {/* 4 or 8 pairs fill four columns; otherwise three, so no card is left alone in a row. */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${pairs.length % 4 === 0 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6`}>
          {pairs.map((pair) => (
            <Slider key={pair.id} pair={pair} />
          ))}
        </div>
      </div>
    </section>
  )
}
