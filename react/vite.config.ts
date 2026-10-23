import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

const DEFAULT_API = 'https://fpambacend.onrender.com/api'

/**
 * Content-Security-Policy for built pages: scripts only from this site, data
 * only to the API. Limits what an injected script could do (e.g. send the
 * stored login token elsewhere). Not added in dev, where Vite needs inline
 * scripts for hot reload.
 */
function csp(apiBase: string): Plugin {
  const api = new URL(apiBase)
  const ws = `${api.protocol === 'https:' ? 'wss:' : 'ws:'}//${api.host}`
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",   // Leaflet sets inline styles
    "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
    "img-src 'self' data: blob: https:",                                                          // map tiles, photos
    `connect-src 'self' ${api.origin} ${ws}`,
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'fpamas-csp',
    apply: 'build',
    transformIndexHtml: html => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`),
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // The RMS prototype is left out of builds with VITE_RMS=off, so its code
  // never ships there.
  const rmsOff = env.VITE_RMS === 'off'
  return {
    plugins: [react(), csp(env.VITE_API_BASE || DEFAULT_API)],
    define: { __BUILD_ID__: JSON.stringify(new Date().toISOString()) },
    resolve: {
      alias: {
        '@rms-routes': fileURLToPath(new URL(rmsOff ? './src/rms/routes.off.tsx' : './src/rms/routes.tsx', import.meta.url)),
      },
    },
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
  }
})
