import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts': ['recharts'],
          'pdf': ['html2canvas'],
          'ui': ['lucide-react', 'react-hot-toast', 'framer-motion'],
          'sentry': ['@sentry/react'],
          'forms': ['react-hook-form', 'zustand', 'axios'],
        },
      },
    },
  },
});
