import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Keep recharts (and its d3 deps) out of the app chunk
        manualChunks: (id) => {
          if (/node_modules\/(recharts|d3-|victory-vendor)/.test(id)) return 'recharts'
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor'
        },
      },
    },
  },
  css: { preprocessorOptions: { scss: { api: 'modern-compiler' } } },
})
