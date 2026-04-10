import { Link } from 'react-router-dom'
import { SparklesIcon, ClockIcon } from '@heroicons/react/24/outline'

interface ImageCardProps {
  image: {
    id: string
    originalUrl: string
    filename: string
    createdAt: string
    generations: Array<{ id: string; status: string; url?: string }>
  }
}

export default function ImageCard({ image }: ImageCardProps) {
  const completedCount = image.generations.filter((g) => g.status === 'COMPLETED').length
  const hasGenerations = image.generations.length > 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        <img
          src={image.originalUrl}
          alt="Product"
          className="w-full h-full object-cover"
        />
        {hasGenerations && (
          <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
            {completedCount}/{image.generations.length}
          </div>
        )}
      </div>

      <div className="p-4">
        <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
          <ClockIcon className="h-3 w-3" />
          {new Date(image.createdAt).toLocaleDateString('pl-PL')}
        </p>

        {hasGenerations ? (
          <Link
            to={`/generate/${image.id}`}
            className="flex items-center justify-center gap-2 w-full bg-blue-50 text-blue-700 rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-100 transition-colors"
          >
            <SparklesIcon className="h-4 w-4" />
            Zobacz warianty
          </Link>
        ) : (
          <Link
            to={`/generate/${image.id}`}
            className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <SparklesIcon className="h-4 w-4" />
            Generuj grafiki
          </Link>
        )}
      </div>
    </div>
  )
}
