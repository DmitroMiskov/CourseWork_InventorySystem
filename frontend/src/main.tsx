import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import axios from 'axios';

// 👇 Налаштування Axios (тепер запити йтимуть на бекенд)
axios.defaults.baseURL = 'http://localhost:8080';

// 👇 Додаємо перехоплювач, щоб автоматично чіпляти токен до кожного запиту
axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)