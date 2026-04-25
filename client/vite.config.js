import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // In production the frontend talks directly to Render backend
  // Set VITE_API_URL in your build environment or .env.production
  server: {
    port: 5173,
    proxy: {
      '/api':       { target: 'http://localhost:3001', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
});
