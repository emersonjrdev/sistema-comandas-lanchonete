self.addEventListener('install', (event) => {
  event.waitUntil(Promise.resolve())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.resolve())
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})
