import axios from 'axios';

// Базовий URL сервера (без /api)
export const API_BASE_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
  : (import.meta.env.PROD ? '' : 'http://localhost:8080');

// Повний URL до REST API
export const API_URL = import.meta.env.VITE_API_URL || (API_BASE_URL ? `${API_BASE_URL}/api` : '/api');

// URL до SignalR Hub
export const HUB_URL = API_BASE_URL ? `${API_BASE_URL}/hubs/inventory` : '/hubs/inventory';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Автоматичне підставляння токена авторизації для захищених ендпоінтів
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;