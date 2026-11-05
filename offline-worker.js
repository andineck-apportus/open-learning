const CACHE_NAME = '__CACHE_NAME__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(
    names.filter(name => name.startsWith('open-learning-shell-') && name !== CACHE_NAME)
      .map(name => caches.delete(name))
  )));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(new URL('index.html', scope).href)));
    return;
  }

  if (!PRECACHE.some(path => new URL(path, scope).pathname === url.pathname)) return;
  event.respondWith(caches.open(CACHE_NAME).then(cache => cache.match(request, { ignoreVary: true }).then(cached => cached || fetch(request))));
});
