import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

export default api

// Auth
export const authApi = {
  register: (data: { email: string; password: string; name?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
}

// Users
export const usersApi = {
  getMe: () => api.get('/users/me'),
  updateProfile: (data: { name?: string }) => api.patch('/users/me', data),
}

// Images
export const imagesApi = {
  upload: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/images/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  getAll: (page = 1, limit = 20) =>
    api.get(`/images?page=${page}&limit=${limit}`),
  getById: (id: string) => api.get(`/images/${id}`),
  delete: (id: string) => api.delete(`/images/${id}`),
}

// Generation
export const generationApi = {
  getStyles: () => api.get('/generation/styles'),
  startGeneration: (imageId: string, basePrompt?: string) =>
    api.post(`/generation/${imageId}/start`, basePrompt ? { basePrompt } : {}),
  startCustomGeneration: (imageId: string, userPrompt: string, referenceFile?: File) => {
    const formData = new FormData()
    formData.append('userPrompt', userPrompt)
    if (referenceFile) formData.append('reference', referenceFile)
    return api.post(`/generation/${imageId}/custom`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  getResults: (imageId: string) =>
    api.get(`/generation/${imageId}/results`),
  getById: (id: string) => api.get(`/generation/result/${id}`),
}

// Payments
export const paymentsApi = {
  getPackages: () => api.get('/payments/packages'),
  createCheckout: (packageId: string) => api.post('/payments/checkout', { packageId }),
  getHistory: () => api.get('/payments/history'),
}
