import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

/** Remove SW antigo que quebrava /caixa; registra versão corrigida. */
async function configurarServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  try {
    const registros = await navigator.serviceWorker.getRegistrations()
    for (const reg of registros) {
      await reg.unregister()
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
    await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
  } catch (error) {
    console.warn('Service worker não configurado:', error)
  }
}

window.addEventListener('load', () => {
  configurarServiceWorker()
})

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

// Esconde a splash quando o app estiver montado (após paint + tempo mínimo)
const hideSplash = () => {
  const splash = document.getElementById('splash')
  if (splash) splash.classList.add('loaded')
}
const minSplashTime = 400
const t0 = Date.now()
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const elapsed = Date.now() - t0
    const delay = Math.max(0, minSplashTime - elapsed)
    setTimeout(hideSplash, delay)
  })
})
