import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Це важливо для Docker
    port: 5173,
    proxy: {
      '/api': {
        // 👇 ГОЛОВНА ЗМІНА ТУТ:
        target: 'http://inventory-api:8080', 
        changeOrigin: true,
        secure: false,
      },
      '/images': {
         // 👇 І ТУТ ТАКОЖ:
         target: 'http://inventory-api:8080',
         changeOrigin: true,
         secure: false,
      }
    }
  }
})