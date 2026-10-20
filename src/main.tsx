import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.tsx'
import { BASENAME } from './config'

// Pages outside the app link to /app/?to=/some-route. /app/ is a real file on
// every server, whereas /app/some-route only works where the host rewrites it
// to index.html (Vercel does; a plain local server doesn't).
const to = new URLSearchParams(window.location.search).get('to')
if (to && to.startsWith('/') && !to.startsWith('//')) window.history.replaceState(null, '', BASENAME + to)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
