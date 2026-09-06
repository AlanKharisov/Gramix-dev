import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export function offlineBuild() {
  let outDir;
  return {
    name: 'gramix-offline-shell',
    apply: 'build',
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir); },
    async closeBundle() {
      const files = (await readdir(outDir, { recursive: true })).filter(file =>
        (/\.(?:js|css|html|svg|webp|webmanifest)$/.test(file) || /^app-icon-\d+\.png$/.test(file)) && file !== 'sw.js');
      const hash = createHash('sha256').update(await readFile(path.join(outDir, 'index.html'))).digest('hex').slice(0, 16);
      const urls = files.map(file => '/' + file.split(path.sep).join('/'));
      await writeFile(path.join(outDir, 'sw.js'), `
const CACHE = 'gramix-shell-${hash}';
const ASSETS = ${JSON.stringify(urls)};
self.addEventListener('install', event => {
  // Do not skipWaiting: never reload or replace a user's unsaved form.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('gramix-shell-') && key !== CACHE).map(key => caches.delete(key)))));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Never persist API, Firebase, tokens, or user documents in Cache Storage.
  if (event.request.mode === 'navigate' && /^\\/(?:main|stats|profile|manual-entry|login|register|biometric|body-bio|history)?\\/?$/.test(url.pathname)) {
    event.respondWith(fetch(event.request, { signal: AbortSignal.timeout(4000) }).then(response => {
      if (!response.ok) throw new Error('navigation_failed');
      return response;
    }).catch(() => caches.open(CACHE).then(cache => cache.match('/index.html'))));
  } else if (ASSETS.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname)).then(cached => cached || fetch(event.request)));
  }
});
`);
    },
  };
}
