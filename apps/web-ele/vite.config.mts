import { defineConfig } from '@vben/vite-config';

import ElementPlus from 'unplugin-element-plus/vite';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      plugins: [
        ElementPlus({
          format: 'esm',
        }),
      ],
      server: {
        proxy: {
          '/mockapi': {
            target: 'http://192.168.124.8:5333', // Python FastAPI 的端口
            changeOrigin: true,
            rewrite: (path) => path, // 保持路径不变
          },
          '/api': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            // mock代理目标地址
            target: 'http://192.168.1.99:8080',
            ws: true,
          },
          '/python': {
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api/, ''),
            // mock代理目标地址
            target: 'http://127.0.0.1:5001',
            ws: true,
          },
        },
      },
    },
  };
});
