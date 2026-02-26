import axios from 'axios'
import toast from 'react-hot-toast'

// ─── Axios instance ────────────────────────────────────────────────────────────
const apiClient = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// ─── Auth token helpers ────────────────────────────────────────────────────────
const TOKEN_KEY = 'clickpawpay-token'

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

// ─── Request interceptor — attach JWT ─────────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = tokenStorage.get()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ─── Response interceptor — handle errors ─────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      // Network / timeout
      toast.error('Network error. Please check your connection.')
      return Promise.reject(error)
    }

    const { status, data } = error.response

    switch (status) {
      case 401:
        tokenStorage.clear()
        // Redirect to login unless already on auth pages
        if (
          !window.location.pathname.startsWith('/login') &&
          !window.location.pathname.startsWith('/setup')
        ) {
          window.location.href = '/login'
        }
        toast.error('Session expired. Please log in again.')
        break
      case 403:
        toast.error(data?.error || 'Access denied.')
        break
      case 429:
        toast.error(data?.error || 'Too many requests. Please slow down.')
        break
      case 500:
        toast.error('Server error. Please try again later.')
        break
      default:
        // 400 / 422 validation errors — let the caller handle these
        break
    }

    return Promise.reject(error)
  }
)

// ─── Auth endpoints ────────────────────────────────────────────────────────────
export const auth = {
  /**
   * Register a new tenant instance
   * @param {{ subdomain, name, email, password, slickpayKey, plan? }} data
   */
  register: (data) => apiClient.post('/auth/register', data),

  /**
   * Login and receive a JWT
   * @param {{ subdomain, email, password }} data
   * @returns {Promise<{ token: string, tenant: object }>}
   */
  login: async (data) => {
    const res = await apiClient.post('/auth/login', data)
    if (res.data.token) {
      tokenStorage.set(res.data.token)
    }
    return res.data
  },

  logout: () => {
    tokenStorage.clear()
  },
}

// ─── Chat endpoints ────────────────────────────────────────────────────────────
export const chat = {
  /**
   * Send a message to the AI agent
   * @param {{ message: string, conversationId?: string }} data
   * @returns {Promise<{ reply: string, conversationId: string, toolCallsExecuted: object[] }>}
   */
  send: (data) => apiClient.post('/chat', data).then((r) => r.data),

  /**
   * Fetch messages for a conversation
   * @param {string} conversationId
   */
  getMessages: (conversationId) =>
    apiClient.get(`/chat/${conversationId}`).then((r) => r.data),

  /**
   * List all conversations for the tenant
   */
  listConversations: () => apiClient.get('/chat/conversations').then((r) => r.data),
}

// ─── Transactions endpoints ────────────────────────────────────────────────────
export const transactions = {
  /**
   * List transactions with optional filters
   * @param {{ page?, limit?, status?, startDate?, endDate?, search? }} params
   */
  list: (params = {}) =>
    apiClient.get('/transactions', { params }).then((r) => r.data),

  /**
   * Get a single transaction
   * @param {string} id
   */
  get: (id) => apiClient.get(`/transactions/${id}`).then((r) => r.data),

  /**
   * Export transactions as CSV blob URL
   * @param {{ startDate?, endDate?, status? }} params
   * @returns {Promise<string>} blob URL
   */
  exportCsv: async (params = {}) => {
    const res = await apiClient.get('/transactions/export', {
      params,
      responseType: 'blob',
    })
    return URL.createObjectURL(
      new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
    )
  },
}

// ─── Balance endpoint ──────────────────────────────────────────────────────────
export const balance = {
  /**
   * Fetch SlickPay account balance
   */
  get: () => apiClient.get('/balance').then((r) => r.data),
}

// ─── Settings endpoints ────────────────────────────────────────────────────────
export const settings = {
  /**
   * Get current tenant settings (keys are masked)
   */
  get: () => apiClient.get('/settings').then((r) => r.data),

  /**
   * Update settings (AI provider, Telegram config, etc.)
   * @param {object} data
   */
  update: (data) => apiClient.put('/settings', data).then((r) => r.data),

  /**
   * Test a specific integration
   * @param {'openai'|'gemini'|'slickpay'|'telegram'} provider
   */
  test: (provider) =>
    apiClient.post('/settings/test', { provider }).then((r) => r.data),
}

// ─── Default export (raw client, for custom calls) ─────────────────────────────
export default apiClient
