/* ═══════════════════════════════════════════════════════
   TASWIRA SPACE INK v2 — Service Worker
   Offline-first: app shell + tile caching strategies
   ═══════════════════════════════════════════════════════ */

'use strict';

const CACHE_VERSION = 'v2.0.0';
const SHELL_CACHE   = `taswira-shell-${CACHE_VERSION}`;
const TILE_CACHE    = `taswira-tiles-${CACHE_VERSION}`;
const FONT_CACHE    = `taswira-fonts-${CACHE_VERSION}`;

// App shell — files that must be available offline
const SHELL_FILES = [
  '/',
  '/index.html',
  '/styles/main.css',
  '/styles/panels.css',
  '/styles/animations.css',
  '/src/app.js',
  '/src/state.js',
  '/src/event-bus.js',
  '/src/core/map-engine.js',
  '/src/core/theme-engine.js',
  '/src/core/export-engine.js',
  '/src/modules/text-overlay.js',
  '/src/modules/geojson-module.js',
  '/src/modules/uav-module.js',
  '/src/services/geocoder.js',
  '/src/services/ai-service.js',
  '/src/ui/ui-controller.js',
  '/data/presets/cities.js',
  '/manifest.json',
];

// External CDN assets to cache on first fetch
const CDN_PREFIXES = [
  'https://unpkg.com/maplibre-gl',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
];

// Tile hosts — cached with stale-while-revalidate
const TILE_HOSTS = [
  'tiles.openfreemap.org',
];

// Max entries for tile cache (keep disk usage bounded)
const MAX_TILE_ENTRIES = 500;
const MAX_TILE_AGE_MS  = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Install: Pre-cache app shell ─────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v' + CACHE_VERSION);
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Shell pre-cache failed:', err))
  );
});

// ─── Activate: Clean old caches ───────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v' + CACHE_VERSION);
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith('taswira-') && !k.includes(CACHE_VERSION))
          .map(k => { console.log('[SW] Deleting old cache:', k); return caches.delete(k); })
      ))
      .then(() => self.clients.claim())
  );
});

// ─── Fetch: Multi-strategy routing ────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const req = event.request;

  // Skip non-GET, cross-origin API calls (Anthropic, Nominatim)
  if (req.method !== 'GET') return;
  if (url.hostname === 'api.anthropic.com') return;
  if (url.hostname === 'nominatim.openstreetmap.org') return;

  // Strategy 1: Map tiles — Stale-While-Revalidate + bounded cache
  if (TILE_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(tileStrategy(req));
    return;
  }

  // Strategy 2: Fonts — Cache-First (immutable)
  if (url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') {
    event.respondWith(cacheFirst(req, FONT_CACHE));
    return;
  }

  // Strategy 3: CDN assets (MapLibre, jsPDF) — Cache-First
  if (CDN_PREFIXES.some(p => req.url.startsWith(p))) {
    event.respondWith(cacheFirst(req, SHELL_CACHE));
    return;
  }

  // Strategy 4: App shell — Network-First with shell fallback
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirstWithShell(req));
    return;
  }
});

// ─── Strategy: Cache-First ────────────────────────────
async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const response = await fetch(req);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, response.clone());
    }
    return response;
  } catch(e) {
    return new Response('Offline — resource not cached', { status: 503 });
  }
}

// ─── Strategy: Network-First with shell fallback ──────
async function networkFirstWithShell(req) {
  try {
    const response = await fetch(req);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(req, response.clone());
      return response;
    }
    throw new Error('Non-OK response');
  } catch(e) {
    const cached = await caches.match(req);
    if (cached) return cached;
    // SPA fallback — serve index.html for navigation requests
    if (req.mode === 'navigate') {
      const shell = await caches.match('/index.html');
      if (shell) return shell;
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
  }
}

// ─── Strategy: Tile — Stale-While-Revalidate ─────────
async function tileStrategy(req) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(req);

  const fetchAndCache = fetch(req).then(async response => {
    if (response.ok) {
      await cache.put(req, response.clone());
      await trimTileCache(cache);
    }
    return response;
  }).catch(() => null);

  // Serve cached immediately while revalidating in background
  if (cached) {
    fetchAndCache.catch(() => {}); // background refresh, don't await
    return cached;
  }

  // No cache — wait for network
  const response = await fetchAndCache;
  return response || new Response('Tile not available offline', { status: 503 });
}

// ─── Trim tile cache to MAX_TILE_ENTRIES ──────────────
async function trimTileCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_TILE_ENTRIES) return;
  // Delete oldest (FIFO - first keys added are first deleted)
  const toDelete = keys.slice(0, keys.length - MAX_TILE_ENTRIES);
  await Promise.all(toDelete.map(k => cache.delete(k)));
}

// ─── Message Handler (from app) ───────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_TILE_CACHE') {
    caches.delete(TILE_CACHE).then(() => {
      event.source?.postMessage({ type: 'TILE_CACHE_CLEARED' });
    });
  }
  if (event.data?.type === 'GET_CACHE_SIZE') {
    getCacheSize().then(size => {
      event.source?.postMessage({ type: 'CACHE_SIZE', size });
    });
  }
});

// ─── Cache Size Utility ───────────────────────────────
async function getCacheSize() {
  const sizes = {};
  for (const name of [SHELL_CACHE, TILE_CACHE, FONT_CACHE]) {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    sizes[name] = keys.length;
  }
  return sizes;
}
