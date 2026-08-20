import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// приложение живёт на admin.hitrack.am/next/ (nginx alias /var/www/admin-next)
export default defineConfig({
  base: '/next/',
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'https://api.hitrack.am', changeOrigin: true, ws: true },
      '/v2': { target: 'https://api.hitrack.am', changeOrigin: true },
    },
  },
});
