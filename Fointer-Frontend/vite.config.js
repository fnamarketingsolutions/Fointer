import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { setDefaultResultOrder } from 'node:dns'

// Node 17+ resolves `localhost` to ::1 first; the WS proxy then hits
// ECONNREFUSED if the backend is on IPv4. Pin to IPv4 for local proxying.
setDefaultResultOrder('ipv4first')

const backendOrigin = 'http://127.0.0.1:5001'

// Shared between dev (`server`) and production preview (`preview`).
const apiProxy = {
  '/api': {
    target: backendOrigin,
    changeOrigin: true,
    secure: false,
  },
  '/socket.io': {
    target: backendOrigin,
    changeOrigin: true,
    secure: false,
    ws: true,
    rewriteWsOrigin: true,
  },
}

const coopHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Empty prefix so TUNNEL_HOST (not VITE_*) is available in config only —
  // it must never be inlined into the client bundle.
  const env = loadEnv(mode, process.cwd(), '')
  const tunnelHost = env.TUNNEL_HOST?.trim()
  const allowedHosts = [
    'localhost',
    ...(tunnelHost ? [tunnelHost] : []),
  ]

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      // Never ship original source via .map files.
      sourcemap: false,
      // Vite 8 uses Oxc/Rolldown — drop console/debugger via minifier compress.
      ...(mode === 'production'
        ? {
            rolldownOptions: {
              output: {
                minify: {
                  compress: {
                    dropConsole: true,
                    dropDebugger: true,
                  },
                },
              },
            },
          }
        : {}),
    },
    server: {
      headers: coopHeaders,
      // Set TUNNEL_HOST=your-subdomain.ngrok-free.dev when you need a public
      // tunnel. Prefer npm run build && npm run preview for public links, and
      // enable ngrok auth (basic auth / OAuth) in front of any tunnel.
      allowedHosts,
      // Browser talks to same-origin /api (works over ngrok HTTPS).
      // Vite forwards to the local backend — avoids loopback CORS blocks.
      proxy: apiProxy,
    },
    // Serve the minified dist/ over the same hosts + /api proxy (port 4173).
    preview: {
      headers: coopHeaders,
      allowedHosts,
      proxy: apiProxy,
    },
  }
})