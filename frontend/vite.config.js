import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const hmrClientPort = Number(process.env.VITE_HMR_CLIENT_PORT) || null;

export default defineConfig({
  plugins: [react()],

  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['assignment-hub.cskmitl.com'],
    hmr: hmrClientPort ? { clientPort: hmrClientPort, protocol: 'wss' } : {},
    watch: { usePolling: true },
    proxy: {
      '/api': { target: 'http://backend:3000', changeOrigin: true },
    },
  },

  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: ['assignment-hub.cskmitl.com', '161.246.xx.xx'],   // ใส่ IP VM จริง
    proxy: {
      '/api': { target: 'http://backend:3000', changeOrigin: true },
    },
  },
});