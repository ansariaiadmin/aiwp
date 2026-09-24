/**
 * AiWp service worker — offline support for the admin PWA.
 *
 * Strategy, deliberately conservative:
 *   * same-origin *static* assets (/_next/static, icons, fonts): cache-first.
 *     They are content-hashed, so a stale entry is impossible.
 *   * navigations: network-first, falling back to a cached app shell when
 *     offline, so a cold open with no connection still renders the UI.
 *   * everything else — especially /api/ POSTs (login, orders, licensing)
 *     and anything cross-origin: network-only. The platform is a commerce
 *     and licensing backend; serving a stale balance or a stale licence
 *     state is worse than showing "offline".
 *
 * The cache is versioned; a new release swaps the cache name and the old
 * one is deleted on activate, so a user is never pinned to an old shell.
 */

const VERSION = "aiwp-v1";
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;

const PRECACHE = [
  "/icon-192.png",
  "/icon-512.png",
  "/maskable-icon.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL && key !== STATIC)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only same-origin GET requests ever touch the cache.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to the cached shell offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() =>
          caches
            .match(request)
            .then((hit) => hit || caches.match("/admin").then((h) => h || caches.match("/"))),
        ),
    );
    return;
  }

  // Static, content-hashed assets: cache-first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".ttf") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(STATIC).then((cache) => cache.put(request, copy));
            return res;
          }),
      ),
    );
  }
  // API and anything else: network-only (no stale commerce/licence data).
});

self.addEventListener("message", (event) => {
  // Let the page force a refresh of the shell after a deploy.
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
