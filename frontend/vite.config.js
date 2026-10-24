import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // `npm run dev` keeps the app on its own port, so the API is forwarded to the
    // local Vanadristi server instead of relying on a built-in base URL.
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL || 'http://127.0.0.1:8777',
        changeOrigin: true,
      },
    },
  },
});
