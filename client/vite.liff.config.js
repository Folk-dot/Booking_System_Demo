import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist/liff',
    rollupOptions: {
      input: path.resolve(__dirname, 'liff.html'),
    },
  },
  server: {
    port: 5173,
    allowedHosts: 'all',
  },
});
