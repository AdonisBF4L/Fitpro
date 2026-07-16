// FitPro Service Worker v1.0
const CACHE_NAME = 'fitpro-v1';
const OFFLINE_URL = '/Fitpro/';

// Assets to cache on install (app shell)
const PRECACHE_URLS = [
  '/Fitpro/',
  '/Fitpro/index.html',
  '/Fitpro/manifest.json',
  '/Fitpro/icons/icon-192.png',
  '/Fitpro/icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
];

// ═══════════════════════════════════════════════════════
// INSTALL - cache app shell
// ═══════════════════════════════════════════════════════
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS.map(url => {
        return new Request(url, { cache: 'reload' });
      })).catch(() => {
        // If some CDN urls fail, cache what we can
        return cache.addAll(['/Fitpro/', '/Fitpro/index.html']);
      });
    })
  );
  self.skipWaiting();
});

// ═══════════════════════════════════════════════════════
// ACTIVATE - clean old caches
// ═══════════════════════════════════════════════════════
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ═══════════════════════════════════════════════════════
// FETCH - network first, fallback to cache
// ═══════════════════════════════════════════════════════
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and Supabase API calls (always need fresh data)
  if (request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;

  // For navigation requests: network first, fallback to cached index
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/Fitpro/index.html')
          .then(r => r || caches.match('/Fitpro/')))
    );
    return;
  }

  // For static assets (fonts, scripts, icons): cache first, then network
  if (
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('cdn.jsdelivr.net') ||
    request.destination === 'image' ||
    request.destination === 'style' ||
    request.destination === 'script'
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Default: network first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// ═══════════════════════════════════════════════════════
// PUSH NOTIFICATIONS
// ═══════════════════════════════════════════════════════
self.addEventListener('push', event => {
  let data = { title: 'FitPro', body: 'Ai un mesaj nou!', icon: '/Fitpro/icons/icon-192.png', badge: '/Fitpro/icons/icon-72.png' };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch(e) {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: 'fitpro-message',
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: data.url || '/Fitpro/#mesaje' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/Fitpro/#mesaje';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      for (const win of wins) {
        if (win.url.includes('/Fitpro') && 'focus' in win) {
          win.postMessage({ type: 'NAVIGATE', url: target });
          return win.focus();
        }
      }
      return clients.openWindow(target);
    })
  );
});
