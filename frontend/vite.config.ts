import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolveAssetBase } from './config/assetBase.ts';

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: resolveAssetBase(command, process.env),
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    manifest: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': `${import.meta.dirname}/src`,
    },
  },
}));
