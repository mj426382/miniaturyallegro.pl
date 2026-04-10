import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { imagesApi } from '../services/api'
import toast from 'react-hot-toast'
import { ArrowUpTrayIcon, PhotoIcon } from '@heroicons/react/24/outline'

export default function Upload() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const navigate = useNavigate()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0]
    if (selectedFile) {
      setFile(selectedFile)
      const reader = new FileReader()
      reader.onloadend = () => setPreview(reader.result as string)
      reader.readAsDataURL(selectedFile)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  })

  const handleUpload = async () => {
    if (!file) return
    setIsUploading(true)
    try {
      const { data } = await imagesApi.upload(file)
      toast.success('Zdjęcie przesłane pomyślnie!')
      navigate(`/generate/${data.id}`)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Błąd przesyłania')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Prześlij zdjęcie produktu</h1>
        <p className="text-gray-500 mt-1">
          Wyślij zdjęcie swojego produktu, a my wygenerujemy profesjonalne grafiki produktowe w 6 stylach
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : preview
            ? 'border-green-500 bg-green-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />

        {preview ? (
          <div>
            <img
              src={preview}
              alt="Preview"
              className="max-h-64 mx-auto rounded-lg object-contain"
            />
            <p className="mt-3 text-sm text-gray-600">{file?.name}</p>
            <p className="text-xs text-gray-400">
              {((file?.size || 0) / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        ) : (
          <div>
            {isDragActive ? (
              <ArrowUpTrayIcon className="h-16 w-16 text-blue-500 mx-auto mb-4" />
            ) : (
              <PhotoIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            )}
            <p className="text-lg font-medium text-gray-700">
              {isDragActive ? 'Upuść zdjęcie tutaj' : 'Przeciągnij i upuść zdjęcie'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              lub kliknij, aby wybrać plik
            </p>
            <p className="text-xs text-gray-400 mt-2">
              JPG, PNG, WebP • Max 10 MB
            </p>
          </div>
        )}
      </div>

      {file && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => { setFile(null); setPreview(null) }}
            className="btn-secondary flex-1"
          >
            Zmień zdjęcie
          </button>
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className="btn-primary flex-1"
          >
            {isUploading ? 'Przesyłanie...' : 'Prześlij i generuj miniaturki'}
          </button>
        </div>
      )}
    </div>
  )
}
