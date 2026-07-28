import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    allowedHosts: [
      'punctual-droop-viper.ngrok-free.dev',
      'localhost',
    ],
    // Browser talks to same-origin /api (works over ngrok HTTPS).
    // Vite forwards to the local backend — avoids loopback CORS blocks.
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
