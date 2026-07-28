import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Behind a TLS reverse proxy the browser reaches the app on 443, but the HMR
// client would still dial Vite's own 5173 over wss:// and fail. Compose sets
// this to 443 for the `tls` profile and leaves it empty for local dev.
const hmrClientPort = Number(process.env.VITE_HMR_CLIENT_PORT) || null;

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",   // listen on 0.0.0.0 so it's reachable from outside the container
    port: 5173,
    // Vite rejects requests whose Host header it doesn't recognise (DNS-rebinding
    // guard). localhost / 127.0.0.1 are always allowed; any other hostname the dev
    // server is reached through has to be listed here.
    allowedHosts: ['assignment-hubb.duckdns.org'],
    hmr: hmrClientPort ? { clientPort: hmrClientPort, protocol: 'wss' } : true,
    watch: {
      usePolling: true, // needed for hot reload to detect file changes in Docker on Windows
    },
    proxy: {
      // forward API calls to the backend service (same Docker network)
      '/api': 'http://backend:3000',
    },
  },
});
