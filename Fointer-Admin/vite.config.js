import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { setDefaultResultOrder } from 'node:dns'

setDefaultResultOrder('ipv4first')

const backendOrigin = 'http://127.0.0.1:5001'

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

export default defineConfig(({ mode }) => {
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
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    build: {
      sourcemap: false,
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
      port: 5174,
      strictPort: true,
      headers: coopHeaders,
      allowedHosts,
      proxy: apiProxy,
    },
    preview: {
      port: 4174,
      headers: coopHeaders,
      allowedHosts,
      proxy: apiProxy,
    },
  }
})