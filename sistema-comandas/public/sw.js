/* Service worker mínimo: não intercepta rotas do SPA (ex.: /caixa).
   Versões antigas quebravam navegação ao devolver undefined no fetch. */

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Navegação (/caixa, /comandas, etc.): sempre rede — Vercel devolve index.html
  if (request.mode === 'navigate') return

  // Só tenta cache para assets estáticos (JS/CSS/imagens)
  const isAsset =
    url.pathname.startsWith('/assets/') ||
    /\.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?)$/i.test(url.pathname)

  if (!isAsset) return

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request)
        if (response.ok) return response
      } catch {
        // offline ou erro de rede
      }
      const cached = await caches.match(request)
      if (cached) return cached
      return new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    })()
  )
})
