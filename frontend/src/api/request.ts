import axios from 'axios'
import notify from 'devextreme/ui/notify'

const request = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '', // Use relative path to leverage Vite proxy
  timeout: 10000
})

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers = config.headers ?? {}
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          notify('Authentication failed. Please sign in again.', 'error', 3000)
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          window.location.href = '/login'
          break
        case 403:
          notify('You do not have access to this resource.', 'warning', 3000)
          break
        case 404:
          notify('Requested resource not found.', 'warning', 3000)
          break
        case 500:
          notify('Server error. Please try again later.', 'error', 3000)
          break
        default:
          notify(error.response.data?.message || 'Request failed.', 'error', 3000)
      }
    } else {
      notify('Network error. Please check your connection.', 'error', 3000)
    }
    return Promise.reject(error)
  }
)

export default request
