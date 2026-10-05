import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The full-stack e2e test (playwright.fullstack.config.ts) points the proxy at its own test backend.
const apiTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:3000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
