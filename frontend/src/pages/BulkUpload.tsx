import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { imagesApi, generationApi } from '../services/api'
import toast from 'react-hot-toast'
import {
  ArrowUpTrayIcon,
  PhotoIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  SparklesIcon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'

type FileStatus = 'queued' | 'uploading' | 'generating' | 'done' | 'error'

interface FileItem {
  id: string
  file: File
  preview: string
  status: FileStatus
  error?: string
  imageId?: string
}

export default function BulkUpload() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newItems: FileItem[] = acceptedFiles.map((file) => ({
      id: Math.random().toString(36).slice(2),
      file,
      preview: URL.createObjectURL(file),
      status: 'queued',
    }))
    setFiles((prev) => [...prev, ...newItems])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 50,
    maxSize: 10 * 1024 * 1024,
  })

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const updateFile = (id: string, patch: Partial<FileItem>) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  const startAll = async () => {
    const queued = files.filter((f) => f.status === 'queued')
    if (!queued.length) return
    setIsRunning(true)

    for (const item of queued) {
      // 1. Upload
      updateFile(item.id, { status: 'uploading' })
      let imageId: string
      try {
        const { data } = await imagesApi.upload(item.file)
        imageId = data.id
        updateFile(item.id, { status: 'generating', imageId })
      } catch (err: any) {
        updateFile(item.id, {
          status: 'error',
          error: err.response?.data?.message || 'Błąd przesyłania',
        })
        continue
      }

      // 2. Start generation
      try {
        await generationApi.startGeneration(imageId)
        updateFile(item.id, { status: 'done', imageId })
      } catch (err: any) {
        updateFile(item.id, {
          status: 'error',
          error: err.response?.data?.message || 'Błąd generowania',
        })
      }
    }

    setIsRunning(false)
    toast.success('Wszystkie pliki zostały przetworzone!')
  }

  const queuedCount = files.filter((f) => f.status === 'queued').length
  const doneCount = files.filter((f) => f.status === 'done').length
  const errorCount = files.filter((f) => f.status === 'error').length
  const activeCount = files.filter((f) => f.status === 'uploading' || f.status === 'generating').length

  const statusIcon = (status: FileStatus) => {
    if (status === 'done') return <CheckCircleIcon className="h-5 w-5 text-green-500 shrink-0" />
    if (status === 'error') return <ExclamationCircleIcon className="h-5 w-5 text-red-500 shrink-0" />
    if (status === 'uploading') return (
      <div className="h-5 w-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
    )
    if (status === 'generating') return (
      <div className="h-5 w-5 rounded-full border-2 border-purple-500 border-t-transparent animate-spin shrink-0" />
    )
    return <div className="h-5 w-5 rounded-full border-2 border-gray-300 shrink-0" />
  }

  const statusLabel = (status: FileStatus) => {
    if (status === 'queued') return <span className="text-xs text-gray-500">Oczekuje</span>
    if (status === 'uploading') return <span className="text-xs text-blue-600 font-medium">Przesyłanie...</span>
    if (status === 'generating') return <span className="text-xs text-purple-600 font-medium">Generowanie miniaturek...</span>
    if (status === 'done') return <span className="text-xs text-green-600 font-medium">Gotowe</span>
    if (status === 'error') return <span className="text-xs text-red-600 font-medium">Błąd</span>
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Masowe przesyłanie zdjęć</h1>
        <p className="text-gray-500 mt-1">
          Prześlij wiele zdjęć naraz — dla każdego zostaną automatycznie wygenerowane 12 miniaturek
        </p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-6 ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <ArrowUpTrayIcon className={`h-12 w-12 mx-auto mb-3 ${isDragActive ? 'text-blue-500' : 'text-gray-300'}`} />
        <p className="text-base font-medium text-gray-700">
          {isDragActive ? 'Upuść zdjęcia tutaj' : 'Przeciągnij wiele zdjęć lub kliknij'}
        </p>
        <p className="text-sm text-gray-500 mt-1">JPG, PNG, WebP • Max 10 MB każde • Do 50 plików</p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
              <span className="text-sm font-medium text-gray-700">
                {files.length} {files.length === 1 ? 'plik' : 'pliki/plików'}
                {doneCount > 0 && <span className="text-green-600 ml-2">• {doneCount} gotowe</span>}
                {errorCount > 0 && <span className="text-red-600 ml-2">• {errorCount} błędów</span>}
                {activeCount > 0 && <span className="text-blue-600 ml-2">• {activeCount} w toku</span>}
              </span>
              {!isRunning && (
                <button
                  onClick={() => setFiles([])}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Wyczyść wszystko
                </button>
              )}
            </div>

            {/* File rows */}
            <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {files.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <img
                    src={item.preview}
                    alt={item.file.name}
                    className="h-12 w-12 object-cover rounded-lg border border-gray-200 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.file.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {statusLabel(item.status)}
                      {item.error && (
                        <span className="text-xs text-red-500">— {item.error}</span>
                      )}
                    </div>
                  </div>
                  {statusIcon(item.status)}
                  {item.status === 'done' && item.imageId && (
                    <Link
                      to={`/generate/${item.imageId}`}
                      className="text-blue-600 hover:text-blue-700 shrink-0"
                      title="Otwórz generator"
                    >
                      <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    </Link>
                  )}
                  {(item.status === 'queued' || item.status === 'error') && !isRunning && (
                    <button
                      onClick={() => removeFile(item.id)}
                      className="text-gray-300 hover:text-red-400 shrink-0"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Action bar */}
          <div className="flex gap-3">
            <button
              onClick={startAll}
              disabled={isRunning || queuedCount === 0}
              className="btn-primary flex items-center gap-2 flex-1"
            >
              <SparklesIcon className="h-5 w-5" />
              {isRunning
                ? `Przetwarzanie... (${activeCount} w toku)`
                : `Prześlij i generuj ${queuedCount > 0 ? `(${queuedCount})` : 'wszystkie'}`}
            </button>
          </div>

          {/* Done summary */}
          {!isRunning && doneCount > 0 && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl">
              <p className="text-sm font-medium text-green-800 mb-2">
                ✅ {doneCount} {doneCount === 1 ? 'produkt gotowy' : 'produktów gotowych'} — generowanie miniaturek trwa w tle
              </p>
              <div className="flex flex-wrap gap-2">
                {files.filter((f) => f.status === 'done' && f.imageId).map((f) => (
                  <Link
                    key={f.id}
                    to={`/generate/${f.imageId}`}
                    className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 bg-green-100 hover:bg-green-200 px-2 py-1 rounded-md transition-colors"
                  >
                    <PhotoIcon className="h-3.5 w-3.5" />
                    {f.file.name.replace(/\.[^.]+$/, '')}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {files.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          Brak wybranych plików. Przeciągnij zdjęcia lub kliknij w strefę powyżej.
        </div>
      )}
    </div>
  )
}
