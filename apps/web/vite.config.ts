import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite config. Dev proxy forwards /api and bare API routes to the NestJS server
 * so the SPA and API share an origin during development.
 * Vite 配置。开发代理将 /api 及裸 API 路由转发到 NestJS，使开发期 SPA 与 API 同源。
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
});
