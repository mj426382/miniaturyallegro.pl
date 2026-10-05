/**
 * Spec 18, AC-MOB-004: "download" inside the Android/iOS app. WebViews cannot save a blob or share
 * File objects, so the image is written to the app cache and handed to the native share sheet
 * ("Zapisz obraz" → Photos, or any other app).
 */
export type NativeShareResult = 'share' | 'cancelled'

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => {
      const result = String(reader.result)
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.readAsDataURL(blob)
  })
}

export async function shareFileNatively(blob: Blob, filename: string): Promise<NativeShareResult> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
  const { uri } = await Filesystem.writeFile({ path: filename, data: await blobToBase64(blob), directory: Directory.Cache })
  try {
    await Share.share({ title: filename, files: [uri] })
    return 'share'
  } catch (err) {
    // Both platforms reject with "Share canceled" when the user closes the sheet.
    if (/cancel/i.test(String((err as Error)?.message ?? err))) return 'cancelled'
    throw err
  }
}
