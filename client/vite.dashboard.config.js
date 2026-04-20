import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist/dashboard',
    rollupOptions: {
      input: path.resolve(__dirname, 'dashboard.html'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      '/v1': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
