import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'window',
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Allow all hosts — Nginx/Cloudflare handle domain validation
    allowedHosts: true,
    // Proxy /api → backend so LAN/non-localhost access works in dev
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/p': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
})