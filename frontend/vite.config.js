import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dedicated ports (kept clear of other local stacks). start.sh exports these.
const BACKEND_PORT = process.env.SECTOR_BACKEND_PORT || 8710;
const FRONTEND_PORT = Number(process.env.SECTOR_FRONTEND_PORT || 5710);

export default defineConfig({
  plugins: [react()],
  server: {
    port: FRONTEND_PORT,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${BACKEND_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
