import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.tsx'
import { BASENAME } from './config'
import { installErrorReporting } from './lib/errorReporting'
import { startOfflineSync } from './lib/offlineQueue'

// Pages outside the app link to /app/?to=/some-route. /app/ is a real file on
// every server, whereas /app/some-route only works where the host rewrites it
// to index.html (Vercel does; a plain local server doesn't).
const to = new URLSearchParams(window.location.search).get('to')
if (to && to.startsWith('/') && !to.startsWith('//')) window.history.replaceState(null, '', BASENAME + to)

installErrorReporting()
startOfflineSync()

// Offline support (opening the app with no connection). Production builds only —
// a service worker in dev would serve stale files while you edit.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL }).catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
