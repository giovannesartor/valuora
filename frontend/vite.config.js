import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
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
          'ui': ['lucide-react', 'react-hot-toast', 'framer-motion', '@radix-ui/react-popover', '@radix-ui/react-dropdown-menu', '@radix-ui/react-dialog', '@radix-ui/react-slot', '@radix-ui/react-accordion', '@radix-ui/react-label', '@radix-ui/react-scroll-area', '@radix-ui/react-select', '@radix-ui/react-separator', '@radix-ui/react-switch', '@radix-ui/react-tabs', '@radix-ui/react-tooltip', 'class-variance-authority', 'clsx', 'tailwind-merge', 'cmdk', 'sonner'],
          'sentry': ['@sentry/react'],
          'forms': ['react-hook-form', 'zustand', 'axios'],
        },
      },
    },
  },
});
