import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,   // listen on 0.0.0.0 so it's reachable from outside the container
    port: 5173,
    watch: {
      usePolling: true, // needed for hot reload to detect file changes in Docker on Windows
    },
    proxy: {
      // forward API calls to the backend service (same Docker network)
      '/api': 'http://backend:3000',
    },
  },
});
