import axios from 'axios'

// Use Vite env var VITE_API_URL if provided, otherwise fall back to '/api'
// This allows the dev server to proxy '/api' to the backend during dev,
// or to directly point to the backend (e.g. 'http://localhost:8000') when running without a proxy.
const base = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({ baseURL: base })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hms_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api
