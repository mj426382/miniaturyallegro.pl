import type { FileRejection } from 'react-dropzone'

const MAX_MB = 10

/** Human message for files react-dropzone refused (too big, wrong type, too many). */
export function describeRejection(rejections: FileRejection[]): string {
  const codes = new Set(rejections.flatMap((r) => r.errors.map((e) => e.code)))
  const names = rejections
    .map((r) => r.file.name)
    .slice(0, 3)
    .join(', ')
  if (codes.has('file-too-large')) return `Plik jest za duży (max ${MAX_MB} MB): ${names}`
  if (codes.has('file-invalid-type')) return `Nieobsługiwany format (dozwolone JPG, PNG, WebP): ${names}`
  if (codes.has('too-many-files')) return 'Za dużo plików naraz – wybierz maksymalnie 50.'
  return `Nie można dodać pliku: ${names}`
}
