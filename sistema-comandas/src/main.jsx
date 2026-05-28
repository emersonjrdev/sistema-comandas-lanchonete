import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

/** Evita crash quando extensões (ex.: tradutor) alteram o DOM fora do React. */
function aplicarProtecaoDom() {
  if (typeof window === 'undefined' || window.__pdvDomProtecao) return
  window.__pdvDomProtecao = true

  const originalRemoveChild = Node.prototype.removeChild
  Node.prototype.removeChild = function removeChildSeguro(child) {
    if (child?.parentNode !== this) return child
    try {
      return originalRemoveChild.call(this, child)
    } catch (error) {
      if (error?.name === 'NotFoundError') return child
      throw error
    }
  }
}

async function removerServiceWorkers() {
  if (!('serviceWorker' in navigator)) return
  try {
    const registros = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registros.map((reg) => reg.unregister()))
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
  } catch {
    // Ignora falha de limpeza
  }
}

aplicarProtecaoDom()
removerServiceWorkers()

const rootEl = document.getElementById('root')
const app = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
)

if (import.meta.env.DEV) {
  ReactDOM.createRoot(rootEl).render(<React.StrictMode>{app}</React.StrictMode>)
} else {
  ReactDOM.createRoot(rootEl).render(app)
}

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
