import axios from 'axios'
import { reportError } from './errorReporting'

/**
 * The session lives in an httpOnly cookie set by the API (not readable by JS, so an XSS
 * cannot steal it). Every request carries the custom header the backend requires for
 * cookie-authenticated calls – that header is the CSRF defence.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
})

/** Set by useAuth after the session bootstrap; lets the 401 handler avoid redirect loops. */
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || ''
    const isAuthEndpoint = url.startsWith('/auth/')
    if (error.response?.status === 401 && !isAuthEndpoint) {
      onUnauthorized?.()
    }
    // Server-side failures are reported with the correlation id the API echoes back.
    if (!error.response || error.response.status >= 500) {
      reportError(error, { url, status: error.response?.status, requestId: error.response?.headers?.['x-request-id'] })
    }
    return Promise.reject(error)
  },
)

export default api

export type StyleCategory = 'universal' | 'seasonal' | 'industry'

export interface GenerationStyleInfo {
  id: string
  name: string
  description: string
  starter: boolean
  /** Older API responses have no category – treated as universal. */
  category?: StyleCategory
  /** Seasonal styles in their season are promoted ("Teraz"). */
  inSeason?: boolean
}

export interface StylesResponse {
  styles: GenerationStyleInfo[]
  defaultStyleIds: string[]
}

// Auth
export const authApi = {
  register: (data: { email: string; password: string; name?: string; acceptedTerms: boolean; marketingConsent?: boolean }) => api.post('/auth/register', data),
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  googleLogin: (googleToken: string, acceptedTerms?: boolean) => api.post('/auth/google', { googleToken, ...(acceptedTerms ? { acceptedTerms } : {}) }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) => api.post('/auth/reset-password', { token, password }),
  changePassword: (currentPassword: string, newPassword: string) => api.post('/auth/change-password', { currentPassword, newPassword }),
  logout: () => api.post('/auth/logout'),
  verifyEmail: (token: string) => api.post<{ verified: true; alreadyVerified?: boolean }>('/auth/verify-email', { token }),
  resendVerification: () => api.post<{ sent?: boolean; alreadyVerified?: boolean }>('/auth/resend-verification'),
}

// Users
export const usersApi = {
  getMe: () => api.get('/users/me'),
  updateProfile: (data: { name?: string; marketingConsent?: boolean; notifyBatchDone?: boolean }) => api.patch('/users/me', data),
  deleteAccount: (confirmEmail: string) => api.delete('/users/me', { data: { confirmEmail } }),
}

// Images
export interface GenerationSummary {
  id: string
  status: string
  style?: string | null
  url?: string | null
  createdAt?: string
}

export interface ImageSummary {
  id: string
  originalUrl: string
  filename: string
  createdAt: string
  allegroOfferId?: string | null
  generations: GenerationSummary[]
  hasDescription?: boolean
}

export interface ImageListResponse {
  images: ImageSummary[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

export const imagesApi = {
  upload: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/images/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  getAll: (page = 1, limit = 20) => api.get<ImageListResponse>(`/images?page=${page}&limit=${limit}`),
  getById: (id: string) => api.get(`/images/${id}`),
  delete: (id: string) => api.delete(`/images/${id}`),
}

// Generation
export const generationApi = {
  getStyles: () => api.get<StylesResponse>('/generation/styles'),
  /** Starts generation of the given styles (backend default = starter batch of 3). */
  startGeneration: (imageId: string, options: { styles?: string[]; basePrompt?: string } = {}) =>
    api.post(`/generation/${imageId}/start`, {
      ...(options.styles?.length ? { styles: options.styles } : {}),
      ...(options.basePrompt ? { basePrompt: options.basePrompt } : {}),
    }),
  startCustomGeneration: (imageId: string, userPrompt: string, referenceFile?: File, isRework?: boolean) => {
    const formData = new FormData()
    formData.append('userPrompt', userPrompt)
    if (referenceFile) formData.append('reference', referenceFile)
    if (isRework) formData.append('isRework', 'true')
    return api.post(`/generation/${imageId}/custom`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  getResults: (imageId: string) => api.get(`/generation/${imageId}/results`),
  getById: (id: string) => api.get(`/generation/result/${id}`),
  retryGeneration: (id: string) => api.post(`/generation/retry/${id}`),
  downloadGeneration: (id: string) => api.get(`/generation/download/${id}`, { responseType: 'blob' }),
  /** Finished graphics + offer descriptions of the given photos as one ZIP (spec 15). */
  downloadZip: (imageIds: string[]) => api.post<Blob>('/generation/zip', { imageIds }, { responseType: 'blob' }),
}

// Infographics (spec 14)
export interface InfographicFeature {
  icon: string
  text: string
}

export interface InfographicOptions {
  template: 'features' | 'dimensions'
  title?: string
  features?: InfographicFeature[]
  dimensions?: { width?: number; height?: number; depth?: number; unit: 'mm' | 'cm' | 'm'; weight?: number; weightUnit?: 'g' | 'kg' }
  theme?: 'light' | 'dark'
  accent?: 'red' | 'orange' | 'green' | 'blue' | 'black'
  format?: 'png' | 'jpeg'
}

export const infographicApi = {
  icons: () => api.get<Array<{ id: string; name: string }>>('/generation/infographic-icons'),
  render: (generationId: string, options: InfographicOptions) => api.post<Blob>(`/generation/infographic/${generationId}`, options, { responseType: 'blob' }),
}

export type FeedbackReason = 'product-changed' | 'artifacts' | 'wrong-style' | 'composition' | 'text-or-logo' | 'other'

export interface ImageAdjustments {
  brightness?: number
  contrast?: number
  saturation?: number
  sharpen?: boolean
}

export interface ExportOptions {
  ratio?: '1:1' | '4:3' | '3:4' | '16:9'
  /** User-chosen framing (fractions 0-1 of the rotated source). Without it the whole graphic is fitted on white. */
  crop?: { left: number; top: number; width: number; height: number }
  /** Clockwise rotation applied before framing. */
  rotate?: 0 | 90 | 180 | 270
  adjust?: ImageAdjustments
  size?: number
  format?: 'jpeg' | 'png' | 'webp'
  badgeText?: string
  badgeColor?: 'red' | 'orange' | 'green' | 'blue' | 'black'
  badgePosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

export const feedbackApi = {
  submit: (generationId: string, rating: 1 | -1, reason?: FeedbackReason, comment?: string) =>
    api.post(`/generation/feedback/${generationId}`, { rating, ...(reason ? { reason } : {}), ...(comment ? { comment } : {}) }),
}

export const exportApi = {
  export: (generationId: string, options: ExportOptions) => api.post(`/generation/export/${generationId}`, options, { responseType: 'blob' }),
}

// Offer descriptions (SEO copy attached to an uploaded photo)
export interface OfferDescription {
  title: string
  body: string
  keywords: string[]
  sellerNotes: string | null
  promptEditsUsed: number
  updatedAt: string
}

export interface DescriptionView {
  description: OfferDescription | null
  /** Free edits + purchased packs. */
  promptEditsLimit: number
  promptEditsLeft: number
  canCreate: boolean
  /** Credits for the first description (0 – bonus to the graphics). */
  creditCost: number
  editPackSize: number
  editPackCredits: number
}

export const descriptionsApi = {
  get: (imageId: string) => api.get<DescriptionView>(`/descriptions/${imageId}`),
  create: (imageId: string, notes?: string) => api.post<DescriptionView>(`/descriptions/${imageId}`, notes ? { notes } : {}),
  update: (imageId: string, data: { title: string; body: string; keywords: string[] }) => api.patch<DescriptionView>(`/descriptions/${imageId}`, data),
  refine: (imageId: string, instruction: string) => api.post<DescriptionView>(`/descriptions/${imageId}/refine`, { instruction }),
  buyEditPack: (imageId: string) => api.post<DescriptionView>(`/descriptions/${imageId}/edit-packs`),
}

// Payments
export interface SubscriptionPlan {
  id: string
  name: string
  credits: number
  priceGrosze: number
  priceLabel: string
  description: string
  available: boolean
}

export interface SubscriptionInfo {
  planId: string
  planName: string
  creditsPerMonth: number | null
  status: string
  active: boolean
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

export const paymentsApi = {
  getPackages: () => api.get('/payments/packages'),
  getPlans: () => api.get<SubscriptionPlan[]>('/payments/plans'),
  createCheckout: (packageId: string, acceptedWithdrawalWaiver: boolean) => api.post('/payments/checkout', { packageId, acceptedWithdrawalWaiver }),
  subscribe: (planId: string, acceptedWithdrawalWaiver: boolean) => api.post('/payments/subscribe', { planId, acceptedWithdrawalWaiver }),
  portal: () => api.post('/payments/portal'),
  getSubscription: () => api.get<{ subscription: SubscriptionInfo | null }>('/payments/subscription'),
  getHistory: () => api.get('/payments/history'),
  /** Fresh link to the Stripe invoice PDF of a payment (spec 09). */
  invoiceUrl: (transactionId: string) => api.get<{ url: string }>(`/payments/invoices/${transactionId}`),
}

// Notifications (spec 16)
export const notificationsApi = {
  /** E-mail the owner once every graphic of these photos (>= 3) is finished. */
  registerBatch: (imageIds: string[]) => api.post<{ id: string }>('/notifications/batches', { imageIds }),
  unsubscribe: (token: string) => api.post<{ unsubscribed: true }>(`/notifications/unsubscribe?token=${encodeURIComponent(token)}`),
}

// Admin (spec 16)
export interface AdminUserRow {
  id: string
  email: string
  name: string | null
  createdAt: string
  emailVerified: boolean
  provider: 'password' | 'google' | 'google+password'
  images: number
  completedGenerations: number
  failedGenerations: number
  lastActivityAt: string | null
  credits: number
  freeCreditsLeft: number
  plan: { planId: string; name: string; status: string } | null
  paidTotalGrosze: number
  marketingConsent: boolean
}

export interface AdminEmailEntry {
  id: string
  kind: string
  subject: string
  body: string | null
  sentBy: string | null
  createdAt: string
}

export interface AdminUserDetail extends AdminUserRow {
  subscription: { planId: string; planName: string; status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null
  payments: Array<{ id: string; amountPln: number; creditsAdded: number; status: string; kind: string; createdAt: string; hasInvoice: boolean }>
  emails: AdminEmailEntry[]
}

export interface AdminOverview {
  users: { total: number; last30d: number }
  generations: Record<string, number>
  staleGenerations: number
  revenue: { completedTransactions: number; totalGrosze: number; last30dGrosze: number; creditsSold: number }
  subscriptions: Record<string, number>
  demo: { leads: number; last30d: number }
  ratedGenerations: number
}

export const adminApi = {
  overview: () => api.get<AdminOverview>('/admin/overview'),
  users: (params: { search?: string; page?: number; limit?: number }) =>
    api.get<{ users: AdminUserRow[]; pagination: { page: number; limit: number; total: number; pages: number } }>('/admin/users', { params }),
  user: (id: string) => api.get<AdminUserDetail>(`/admin/users/${id}`),
  sendEmail: (id: string, subject: string, message: string) => api.post<AdminEmailEntry>(`/admin/users/${id}/email`, { subject, message }),
}

// Allegro
export interface AllegroOffer {
  id: string
  name: string
  primaryImage: string | null
  status: string
  price: string | null
}

export const allegroApi = {
  status: () => api.get<{ configured: boolean; connected: boolean; sellerLogin: string | null }>('/allegro/status'),
  authUrl: () => api.get<{ url: string }>('/allegro/auth-url'),
  callback: (code: string, state: string) => api.post('/allegro/callback', { code, state }),
  disconnect: () => api.delete('/allegro/connection'),
  offers: (params: { offset?: number; limit?: number; name?: string } = {}) => api.get<{ offers: AllegroOffer[]; total: number }>('/allegro/offers', { params }),
  importOffer: (offerId: string) => api.post<{ id: string; offerId: string; offerName: string | null }>(`/allegro/offers/${offerId}/import`),
  publish: (offerId: string, generationId: string, position: 'first' | 'last') => api.post(`/allegro/offers/${offerId}/publish`, { generationId, position }),
  /** Sends the photo's offer title/description to the offer (spec 08). */
  publishDescription: (offerId: string, imageId: string, mode: 'replace' | 'prepend', updateTitle: boolean) => api.post(`/allegro/offers/${offerId}/description`, { imageId, mode, updateTitle }),
}
