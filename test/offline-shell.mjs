// Build a real production shell with a test-only identity, then disconnect.
// The production Firebase module is never changed; no real account is used.
import assert from 'node:assert/strict';
import { build } from 'vite';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_MODULE ? await import(process.env.PLAYWRIGHT_MODULE) : require('playwright');
const outDir = await mkdtemp(path.join(tmpdir(), 'gramix-offline-test-'));
await build({
  logLevel: 'error', build: { outDir, emptyOutDir: true },
  define: { 'import.meta.env.VITE_API_BASE': JSON.stringify('https://api.example.invalid/api') },
  plugins: [{
    name: 'test-identity-only', enforce: 'pre',
    load(id) {
      if (!id.endsWith('/src/pages/firebase-config.js')) return;
      return `const user = { uid: 'offline-test', emailVerified: true, providerData: [{providerId:'google.com'}], getIdToken: async () => 'test' };
      export const auth = { currentUser: user, authStateReady: async () => {},
        onAuthStateChanged(cb) { let active = true; queueMicrotask(() => { if(active) cb(user); }); return () => { active = false; }; } };
      export const db = {};`;
    },
  }],
});
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    let file = path.resolve(outDir, '.' + pathname);
    if (!file.startsWith(outDir + path.sep) && file !== outDir) { res.writeHead(403).end(); return; }
    if (!path.extname(file)) file = path.join(outDir, 'index.html');
    const mime = { '.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json', '.webp':'image/webp', '.png':'image/png' };
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true, ...(process.env.TEST_CHROME_PATH ? { executablePath: process.env.TEST_CHROME_PATH } : {}) });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  let calls = 0;
  let unavailable = false;
  await context.route('https://api.example.invalid/api/**', route => {
    if (unavailable) return route.abort('internetdisconnected');
    calls++;
    const url = new URL(route.request().url());
    const payload = url.pathname.endsWith('/account') ? { publicId: '0000001' } :
      url.pathname.endsWith('/collection') ? { documents: [] } :
      { exists: true, data: { profileCompleted: true, emailVerified: true, dailyNorm: { calories: 2000 }, language: 'ru' } };
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify(payload) });
  });
  let page = await context.newPage();
  await page.goto(base + '/manual-entry');
  await page.locator('.me-text-input').first().fill('Offline production draft');
  await page.locator('.me-ingredient-row input').first().fill('Potato');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  assert(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)));
  await page.locator('.me-text-input').first().waitFor();
  const before = calls;
  unavailable = true;
  await context.setOffline(true);
  await page.reload();
  assert.equal(await page.locator('.me-text-input').first().inputValue(), 'Offline production draft');
  assert.equal(await page.locator('.me-ingredient-row input').first().inputValue(), 'Potato');
  await page.close();
  page = await context.newPage();
  const network = await context.newCDPSession(page);
  await network.send('Network.enable');
  await network.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  page.on('pageerror', error => console.error('Cold offline error:', error.message));
  await page.goto(base + '/main');
  try { await page.locator('.gx-primary').click({ timeout: 10000 }); }
  catch (error) { console.error(await page.evaluate(() => ({ text: document.body.innerText, online: navigator.onLine, url: location.href, controlled: Boolean(navigator.serviceWorker.controller) }))); await page.screenshot({ path: '/tmp/gramix-offline-failure.png' }); throw error; }
  assert.equal(await page.locator('.me-text-input').first().inputValue(), 'Offline production draft');
  assert.equal(calls, before, 'No successful backend reads during offline recovery');
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    return (await Promise.all(names.map(async name => (await (await caches.open(name)).keys()).map(request => request.url)))).flat();
  });
  assert(cached.every(url => new URL(url).origin === base && !url.includes('/api/')));
  await page.screenshot({ path: '/tmp/gramix-offline-verified.png' });
  console.log(JSON.stringify({ passed: true, coldOfflineLaunch: true, privateApiCached: false, outDir }));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
