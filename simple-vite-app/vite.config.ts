import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '#': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/mockapi': {
        target: 'http://192.168.124.8:5333',
        changeOrigin: true,
        rewrite: (path) => path,
      },
      '/api': {
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        target: 'http://192.168.1.99:8080',
        ws: true,
      },
      '/python': {
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        target: 'http://127.0.0.1:5001',
        ws: true,
      },
    },
  },
})
