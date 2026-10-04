import { useState } from 'react'
import toast from 'react-hot-toast'
import { generationApi } from '../services/api'
import { track } from '../services/analytics'
import { downloadBlob } from '../utils/download'
import { apiErrorMessage } from '../utils/apiError'

/** Spec 15: one ZIP with the finished graphics and descriptions of the given photos. */
export function useZipDownload() {
  const [isPreparing, setIsPreparing] = useState(false)

  const download = async (imageIds: string[]) => {
    if (!imageIds.length || isPreparing) return
    setIsPreparing(true)
    const toastId = toast.loading('Przygotowuję paczkę ZIP…')
    try {
      const { data } = await generationApi.downloadZip(imageIds)
      const name = `allgrafika-${new Date().toISOString().slice(0, 10)}.zip`
      const method = await downloadBlob(data, name)
      toast.success('Paczka gotowa', { id: toastId })
      if (method !== 'cancelled') track('zip_download', { photos: imageIds.length, method })
    } catch (err) {
      toast.error(await apiErrorMessage(err, 'Nie udało się przygotować paczki ZIP'), { id: toastId })
    } finally {
      setIsPreparing(false)
    }
  }

  return { download, isPreparing }
}
