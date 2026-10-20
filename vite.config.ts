import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The RMS prototype is left out of builds with VITE_RMS=off (.env.embed), so
  // its code never reaches the live site.
  const rmsOff = loadEnv(mode, process.cwd(), 'VITE_').VITE_RMS === 'off'
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@rms-routes': fileURLToPath(new URL(rmsOff ? './src/rms/routes.off.tsx' : './src/rms/routes.tsx', import.meta.url)),
      },
    },
  }
})
