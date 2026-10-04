/**
 * Message of a failed API call. Requests made with `responseType: 'blob'` (ZIP, infographic) get
 * their JSON error body as a Blob, so it is read and parsed here.
 */
export async function apiErrorMessage(err: any, fallback: string): Promise<string> {
  let body = err?.response?.data
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    try {
      body = JSON.parse(await body.text())
    } catch {
      return fallback
    }
  }
  const message = body?.message
  return Array.isArray(message) ? message.join('. ') : message || fallback
}
