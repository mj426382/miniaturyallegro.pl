import { useCallback, useEffect, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { CropRect, toCropRect } from '../utils/crop'

export type Rotation = 0 | 90 | 180 | 270

interface Props {
  image: string
  /** Target aspect (width / height), e.g. 4/3. */
  aspect: number
  /** Clockwise rotation of the source – the crop is reported relative to the rotated image. */
  rotation?: Rotation
  /** CSS filter string for the live tone preview (brightness/contrast/saturate). */
  filter?: string
  /** Fires with the current framing whenever it changes (drag, zoom, media load, aspect change). */
  onChange: (crop: CropRect) => void
  className?: string
}

const MAX_ZOOM = 4

/**
 * Interactive framing for the export: the user drags the graphic under a fixed-ratio frame
 * and zooms with a slider, mouse wheel or pinch. The frame is always fully covered, so the
 * exported image never gets blank bars. Arrow keys move the frame when the editor is focused.
 */
export default function CropEditor({ image, aspect, rotation = 0, filter, onChange, className = '' }: Props) {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)

  // A new ratio, rotation or image starts from a centred frame that shows as much as possible.
  useEffect(() => {
    setPosition({ x: 0, y: 0 })
    setZoom(1)
  }, [aspect, image, rotation])

  const onCropAreaChange = useCallback((areaPercent: Area) => onChange(toCropRect(areaPercent)), [onChange])

  const reset = () => {
    setPosition({ x: 0, y: 0 })
    setZoom(1)
  }

  return (
    <div className={className}>
      <div data-testid="crop-editor" className="relative w-full aspect-square rounded-xl overflow-hidden bg-gray-900 touch-none select-none">
        <Cropper
          image={image}
          crop={position}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect}
          minZoom={1}
          maxZoom={MAX_ZOOM}
          zoomSpeed={0.5}
          showGrid
          onCropChange={setPosition}
          onZoomChange={setZoom}
          onCropAreaChange={onCropAreaChange}
          style={{ mediaStyle: filter ? { filter } : undefined }}
          cropperProps={{ 'aria-label': 'Kadr eksportowanej grafiki' } as any}
        />
      </div>
      <div className="flex items-center gap-3 mt-2">
        <label htmlFor="crop-zoom" className="text-xs text-gray-500 shrink-0">
          Zoom
        </label>
        <input id="crop-zoom" type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-blue-600" />
        <button type="button" onClick={reset} className="text-xs text-blue-600 hover:underline shrink-0">
          Wyśrodkuj
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-1">Przeciągnij grafikę, aby ustawić kadr. Przybliżaj suwakiem, kółkiem myszy lub dwoma palcami.</p>
      {zoom > 2 && <p className="text-xs text-amber-600 mt-1">Mocne przybliżenie może obniżyć ostrość eksportowanej grafiki.</p>}
    </div>
  )
}
