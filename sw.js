// ═══════════════════════════════════════════════════════════════
// PULSE.tv — Service Worker v2.1
// Improved caching, offline support, push notifications
// ═══════════════════════════════════════════════════════════════

const CACHE_VERSION   = 'v2.1.0';
const STATIC_CACHE    = `pulse-static-${CACHE_VERSION}`;
const RUNTIME_CACHE   = `pulse-runtime-${CACHE_VERSION}`;
const IMAGE_CACHE     = `pulse-images-${CACHE_VERSION}`;
const ALL_CACHES      = [STATIC_CACHE, RUNTIME_CACHE, IMAGE_CACHE];

// Assets to precache on install — app shell only
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/channels.js',
  '/favicon.svg',
  '/manifest.json',
];

// External assets to attempt to precache (non-fatal if they fail)
const EXTERNAL_PRECACHE = [
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap',
  'https://cdn.jsdelivr.net/npm/hls.js@latest',
];

// URL patterns that should NEVER be cached
const BYPASS_PATTERNS = [
  /\.m3u8(\?.*)?$/i,       // HLS playlists
  /\.ts(\?.*)?$/i,          // HLS segments
  /\.m4s(\?.*)?$/i,         // DASH segments
  /\.mpd(\?.*)?$/i,         // DASH manifests
  /supabase\.co/,           // Realtime / auth
  /google-analytics\.com/,  // Analytics
  /gstatic\.com\/cv/,       // Cast SDK
  /doubleclick\.net/,       // Ads tracking
  /chrome-extension:\/\//,  // Extension URLs
];

// Domains whose responses should use network-first strategy
const NETWORK_FIRST_DOMAINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

// Max cache sizes (entries) per bucket
const CACHE_LIMITS = {
  [RUNTIME_CACHE]: 60,
  [IMAGE_CACHE]:   80,
};

// ─── Helpers ────────────────────────────────────────────────────

function shouldBypass(url) {
  return BYPASS_PATTERNS.some(p => p.test(url.href));
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

function isStaticAsset(request, url) {
  return (
    ['script','style','font'].includes(request.destination) ||
    /\.(js|css|woff2?|ttf|eot|svg|ico)(\?.*)?$/i.test(url.pathname)
  );
}

function isImageAsset(request, url) {
  return (
    request.destination === 'image' ||
    /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i.test(url.pathname)
  );
}

// Trim a cache to a max number of entries (LRU-style by insertion order)
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys  = await cache.keys();
  if (keys.length > maxEntries) {
    const toDelete = keys.slice(0, keys.length - maxEntries);
    await Promise.all(toDelete.map(k => cache.delete(k)));
  }
}

// Safe cache put — never stores error responses
async function safeCachePut(cacheName, request, response) {
  if (!response || !response.ok || response.status === 206) return;
  // Don't cache opaque responses for static caches (can't inspect them)
  if (response.type === 'opaque' && cacheName === STATIC_CACHE) return;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
    if (CACHE_LIMITS[cacheName]) {
      await trimCache(cacheName, CACHE_LIMITS[cacheName]);
    }
  } catch (e) {
    // Quota exceeded or other storage error — fail silently
    console.warn('[SW] Cache put failed:', e.name);
  }
}

// ─── Install ────────────────────────────────────────────────────

self.addEventListener('install', event => {
  console.log('[SW] Installing', CACHE_VERSION);
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);

      // Cache local app shell — fail fast if any are missing
      try {
        await cache.addAll(PRECACHE_ASSETS);
      } catch (e) {
        console.warn('[SW] App shell precache partial failure:', e);
        // Try individually so one bad URL doesn't block everything
        for (const url of PRECACHE_ASSETS) {
          try { await cache.add(url); } catch (_) {}
        }
      }

      // Cache external assets — completely non-fatal
      for (const url of EXTERNAL_PRECACHE) {
        try {
          const res = await fetch(url, { credentials: 'omit', mode: 'cors' });
          if (res.ok) await cache.put(url, res);
        } catch (_) {}
      }

      await self.skipWaiting();
      console.log('[SW] Installed and skipped waiting');
    })()
  );
});

// ─── Activate ───────────────────────────────────────────────────

self.addEventListener('activate', event => {
  console.log('[SW] Activating', CACHE_VERSION);
  event.waitUntil(
    (async () => {
      // Delete all caches not in current version
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => !ALL_CACHES.includes(name))
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
      // Take control of all open clients immediately
      await self.clients.claim();
      console.log('[SW] Claimed clients');
    })()
  );
});

// ─── Fetch ──────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event;

  // Only handle GET
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return; // Malformed URL — let browser handle it
  }

  // Only handle http / https
  if (!url.protocol.startsWith('http')) return;

  // Hard bypass — streaming, analytics, realtime
  if (shouldBypass(url)) return;

  // ── Navigation requests: network-first, fallback to cached index.html ──
  if (isNavigationRequest(request)) {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  // ── Static app shell assets: cache-first, stale-while-revalidate ──
  if (isStaticAsset(request, url)) {
    event.respondWith(cacheFirstWithRevalidation(request, STATIC_CACHE));
    return;
  }

  // ── Image assets: cache-first with longer TTL ──
  if (isImageAsset(request, url)) {
    event.respondWith(cacheFirstWithRevalidation(request, IMAGE_CACHE));
    return;
  }

  // ── Google Fonts and other known external CDNs: network-first ──
  if (NETWORK_FIRST_DOMAINS.includes(url.hostname)) {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  // ── Everything else: network-first with runtime cache fallback ──
  event.respondWith(networkFirstWithFallback(request, RUNTIME_CACHE));
});

// Strategy: cache-first, background revalidation (stale-while-revalidate)
async function cacheFirstWithRevalidation(request, cacheName) {
  const cached = await caches.match(request, { ignoreSearch: false });

  // Kick off background revalidation regardless
  const revalidate = fetch(request.clone(), { credentials: 'same-origin' })
    .then(response => {
      if (response && response.ok) {
        safeCachePut(cacheName, request, response);
      }
    })
    .catch(() => {});

  if (cached) {
    // Return cached immediately, update in background
    event?.waitUntil?.(revalidate);
    return cached;
  }

  // Nothing in cache — wait for network
  try {
    const response = await fetch(request, { credentials: 'same-origin' });
    await safeCachePut(cacheName, request, response.clone());
    return response;
  } catch (e) {
    return new Response('Offline — asset not cached', {
      status: 503, statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

// Strategy: network-first, fall back to cache, then offline page
async function networkFirstWithFallback(request, cacheName = RUNTIME_CACHE) {
  try {
    const response = await fetch(request, {
      credentials: request.credentials || 'same-origin',
      // Reasonable timeout via AbortController isn't possible here without
      // a keepalive workaround, so we rely on HLS.js timeouts for streams
    });

    if (response && response.ok) {
      // Cache successful responses in background
      safeCachePut(cacheName, request, response.clone());
    }

    return response;
  } catch (_) {
    // Network failed — try cache
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;

    // For navigation requests, return the cached app shell
    if (isNavigationRequest(request)) {
      const shell = await caches.match('/index.html');
      if (shell) return shell;
    }

    // Generic offline response
    return new Response(
      JSON.stringify({ error: 'offline', message: 'No network and no cache available' }),
      {
        status: 503, statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// ─── Message Handling ───────────────────────────────────────────

self.addEventListener('message', event => {
  if (!event.data || typeof event.data !== 'object') return;

  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CLEAR_CACHE': {
      const target = event.data.cache; // optional: clear a specific cache
      const work = target
        ? caches.delete(target)
        : caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));

      work.then(() => {
        console.log('[SW] Cache cleared:', target || 'all');
        event.source?.postMessage?.({ type: 'CACHE_CLEARED', cache: target || 'all' });
      }).catch(e => {
        event.source?.postMessage?.({ type: 'CACHE_CLEAR_FAILED', error: e.message });
      });
      break;
    }

    case 'GET_VERSION':
      event.source?.postMessage?.({ type: 'VERSION', version: CACHE_VERSION });
      break;

    case 'PREFETCH': {
      // Allows app to prefetch a URL into cache proactively
      const urls = Array.isArray(event.data.urls) ? event.data.urls : [];
      Promise.all(
        urls
          .filter(u => {
            try { return !shouldBypass(new URL(u)); } catch { return false; }
          })
          .map(u =>
            fetch(u, { credentials: 'omit', mode: 'no-cors' })
              .then(r => safeCachePut(RUNTIME_CACHE, new Request(u), r))
              .catch(() => {})
          )
      ).then(() => {
        event.source?.postMessage?.({ type: 'PREFETCH_DONE', count: urls.length });
      });
      break;
    }

    default:
      break;
  }
});

// ─── Push Notifications ─────────────────────────────────────────

self.addEventListener('push', event => {
  const defaultData = {
    title: 'Pulse.tv',
    body: 'Something new is on!',
    icon: '/assets/icons/icon-192.png',
    badge: '/assets/icons/icon-96.png',
    tag: 'pulse-push',
    data: { url: '/' },
  };

  let data = { ...defaultData };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...defaultData, ...parsed };
    } catch {
      data.body = event.data.text() || defaultData.body;
    }
  }

  const options = {
    body:               data.body,
    icon:               data.icon,
    badge:              data.badge,
    tag:                data.tag || 'pulse-push',
    data:               data.data || { url: '/' },
    renotify:           false,
    requireInteraction: false,
    silent:             false,
    vibrate:            [200, 100, 200],
    actions: [
      { action: 'watch',   title: '▶ Watch Now' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ─── Notification Click ─────────────────────────────────────────

self.addEventListener('notificationclick', event => {
  const notification = event.notification;
  notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Reuse an existing open window if possible
        for (const client of clientList) {
          try {
            if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
              client.focus();
              client.postMessage({ type: 'NOTIFICATION_CLICK', url: targetUrl });
              return;
            }
          } catch (_) {}
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// ─── Notification Close ─────────────────────────────────────────

self.addEventListener('notificationclose', event => {
  // Telemetry placeholder — could send analytics event here
  console.log('[SW] Notification dismissed:', event.notification.tag);
});

// ─── Background Sync (if supported) ─────────────────────────────

self.addEventListener('sync', event => {
  if (event.tag === 'pulse-sync-favorites') {
    // Placeholder for future background sync of favorites
    event.waitUntil(Promise.resolve());
  }
});

// ─── Periodic Background Sync (if supported) ────────────────────

self.addEventListener('periodicsync', event => {
  if (event.tag === 'pulse-epg-refresh') {
    // Placeholder for future EPG data refresh
    event.waitUntil(Promise.resolve());
  }
});