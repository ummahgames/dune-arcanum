const CACHE = 'dune-arcanum-static-v2-1';
const FILES = ['./', './index.html', './style.css', './main.js', './src/physics.js', './src/engine.js', './src/levels.js', './src/storage.js', './src/audio.js', './src/renderer.js', './assets/sand-gate.svg', './assets/lapis-court.svg', './assets/glass-observatory.svg', './assets/atlas-vault.svg', './assets/mosaic.svg', './assets/orb.svg'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))); });
// New code waits until old game tabs close; never switch versions during a shot.
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('dune-arcanum-static-') && key !== CACHE).map(key => caches.delete(key))))); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
