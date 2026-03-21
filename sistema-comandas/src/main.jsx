import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      // Mantém app funcional e ajuda no diagnóstico de PWA.
      console.error('Falha ao registrar service worker:', error)
    })
  })
}

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
