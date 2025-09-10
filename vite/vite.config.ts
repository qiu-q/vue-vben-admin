import path from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: '#', replacement: path.resolve(__dirname, 'src') },
      // Shims for removing vben deps
      { find: '@vben/preferences', replacement: path.resolve(__dirname, 'src/shims/vben-preferences.ts') },
      { find: '@vben/utils', replacement: path.resolve(__dirname, 'src/shims/vben-utils.ts') },
    ],
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/mockapi': {
        target: 'http://192.168.124.8:5333',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://192.168.1.99:8080',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/python': {
        target: 'http://127.0.0.1:5001',
        ws: true,
        changeOrigin: true,
        // 保持与原工程一致（若需去掉 /python 前缀可改为 path.replace(/^\/python/, '')）
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
}));
