/* JacqueNgel POS service worker
 * - Makes the app installable (Add to Home Screen).
 * - Lets the app open with no signal: the page and its files are cached.
 * Store data (products, sales, utang) is cached separately by Firestore.
 */
const CACHE = 'jn-pos-v3'
// The manifest is never cached here: phones must always read the latest one
// (e.g. screen orientation) when the app is installed.
const SHELL = ['/', '/logo-192.png', '/logo-512.png', '/favicon.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Page loads: try the network first so updates show up, fall back to cache offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // Built files and Google Fonts never change once published: cache first.
  const sameOrigin = url.origin === self.location.origin
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  if ((sameOrigin && (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname))) || isFont) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok || res.type === 'opaque') {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
  // Everything else (Firebase APIs) goes straight to the network.
})
