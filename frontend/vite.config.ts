import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Коли React бачить запит на /api, він перенаправляє його на бекенд
      '/api': {
        target: 'http://localhost:5066', // <-- ВАЖЛИВО: Перевірте, чи порт збігається з вашим Swagger
        changeOrigin: true,
        secure: false,
      }
    }
  }
})