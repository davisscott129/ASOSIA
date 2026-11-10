// Service worker de asoSIA CRM: permite abrir la app sin internet.
// Siempre intenta la red primero (para no quedarse con versiones viejas) y usa la copia guardada si no hay señal.
const CACHE = 'asosia-crm-v1'
const BASE = ['./', './index.html', './manifest.webmanifest', './icono-192.png', './icono.svg']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASE)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  const propio = url.origin === self.location.origin
  const fuentes = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if (!propio && !fuentes) return // Supabase y demás: siempre directo a la red
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok || res.type === 'opaque') { const copia = res.clone(); caches.open(CACHE).then((c) => c.put(req, copia)) }
        return res
      })
      .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  )
})
