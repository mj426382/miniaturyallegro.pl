/**
 * Minimal fetch wrapper for the demo widget (spec 17: no axios on the landing page – it was the
 * largest dependency in the main bundle). Non-2xx responses throw an HttpError carrying the
 * API's `message`, so the widget can show validation errors from the server.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly apiMessage: string | string[] | undefined,
  ) {
    super(`HTTP ${status}`)
  }
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new HttpError(res.status, body?.message)
  }
  return res
}

export async function getJson<T>(url: string): Promise<T> {
  return (await request(url)).json() as Promise<T>
}

export async function postForm<T>(url: string, form: FormData): Promise<T> {
  return (await request(url, { method: 'POST', body: form })).json() as Promise<T>
}

export async function getBlob(url: string): Promise<Blob> {
  return (await request(url)).blob()
}
