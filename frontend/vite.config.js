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
    // Allow Cloudflare Tunnel and your domain
    allowedHosts: [
      '.trycloudflare.com',
      '.eonsclover.com',
      'eonsclover.com',
      'www.eonsclover.com',
      'localhost'
    ],
  },
})