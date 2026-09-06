// Run against `npm run dev -- --host 127.0.0.1 --port 5179`.
// All auth/data/provider calls are mocked; this never writes production data.
import assert from 'node:assert/strict';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5179';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_MODULE ? await import(process.env.PLAYWRIGHT_MODULE) : require('playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.TEST_CHROME_PATH ? { executablePath: process.env.TEST_CHROME_PATH } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  const requests = [];
  const incidents = [];
  let analysisMode = 'invalid';
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/src/pages/firebase-config*', route => route.fulfill({ contentType: 'application/javascript', body: `
    const listeners = new Set();
    const user = { uid: 'test-user', email: 'test@example.invalid', emailVerified: true,
      providerData: [{providerId:'google.com'}], getIdToken: async () => 'test-token' };
    export const auth = { currentUser: user, authStateReady: async () => {},
      onAuthStateChanged(callback) { listeners.add(callback); queueMicrotask(() => { if(listeners.has(callback)) callback(this.currentUser); }); return () => listeners.delete(callback); },
      signOut: async () => {} };
    export const db = { __apiDb:true };
    window.__testAuth = auth;
  ` }));
  const norm = { calories: 2000, proteins: 100, fats: 60, carbs: 200 };
  const profile = { dailyNorm: norm, profileCompleted: true, emailVerified: true, categoryMigrationDone: true, language: 'ru', photoLimit: 10 };
  const meals = Array.from({ length: 80 }, (_, i) => ({ id: 'meal-' + i, data: {
    name: 'Test meal ' + i, date: new Date(Date.now() - i * 86400000).toISOString(), weight: 100,
    calories: 200, protein: 10, fat: 8, carbs: 20,
    ingredients: [{ name: 'Rice', weight: 100, calories: 200, categoryKey: 'other' }],
  } }));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api', '');
    const docPath = url.searchParams.get('path') || '';
    requests.push({ path, docPath, method: route.request().method() });
    const fulfill = payload => route.fulfill({ contentType: 'application/json', body: JSON.stringify(payload) });
    if (path === '/incidents') { incidents.push(route.request().postDataJSON()); return fulfill({ ok: true }); }
    if (path === '/account') return fulfill({ publicId: '0000001' });
    if (path === '/document') {
      if (route.request().method() !== 'GET') return fulfill({ ok: true, data: profile });
      const data = docPath.startsWith('devices/') ? { count: 0, date: new Date().toDateString() }
        : docPath.includes('normHistory') ? { effectiveFrom: '1970-01-01', ...norm } : docPath.startsWith('meal_images') ? { image: null } : profile;
      return fulfill({ exists: true, id: docPath.split('/').at(-1), data });
    }
    if (path === '/collection') return fulfill({ documents: docPath.endsWith('/meals') ? meals : [] });
    if (path === '/analyze' && analysisMode === 'timeout') return;
    if (path === '/analyze') return fulfill({}); // Malformed provider result.
    return fulfill({ ok: true });
  });
  await page.goto(base + (process.env.TEST_START_PATH || '/main'));
  await page.locator('.main-page:visible').waitFor({ timeout: 10000 });
  const historyLength = await page.evaluate(() => history.length);
  await page.locator('.main-page:visible .home-fab').click();
  await page.locator('.add-sheet').waitFor();
  await page.locator('.add-sheet-backdrop').click({ position: { x: 8, y: 8 } });
  await page.locator('.add-sheet').waitFor({ state: 'detached' });
  await page.locator('.main-page:visible .home-fab').click();
  await page.locator('.add-sheet-drag-area').hover();
  const grip = await page.locator('.add-sheet-drag-area').boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + 20);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + 110, { steps: 8 });
  await page.mouse.up();
  await page.locator('.add-sheet').waitFor({ state: 'detached' });
  await page.locator('.main-page:visible .home-tabbar button').nth(1).click();
  await page.locator('.stats-page:visible').waitFor();
  const mealsReads = () => requests.filter(r => r.path === '/collection' && r.docPath.endsWith('/meals')).length;
  assert.equal(mealsReads(), 1, 'Main and Stats should share the meal-list read: ' + JSON.stringify(requests));
  assert.equal(await page.evaluate(() => history.length), historyLength, 'Hub navigation must replace, not push browser history');
  await page.evaluate(() => {
    window.__statsNode = document.querySelector('.stats-page');
    window.__loadingSeen = false;
    window.__watch = new MutationObserver(() => {
      for (const node of document.querySelectorAll('.loading-screen')) if (node.getBoundingClientRect().height > 0) window.__loadingSeen = true;
    });
    window.__watch.observe(document.body, { childList:true, subtree:true, attributes:true });
  });
  await page.locator('.stats-page:visible .home-tabbar button').first().click();
  await page.locator('.main-page:visible').waitFor();
  await page.locator('.main-page:visible .home-tabbar button').nth(1).click();
  await page.locator('.stats-page:visible').waitFor();
  assert.equal(await page.evaluate(() => window.__statsNode === document.querySelector('.stats-page')), true);
  assert.equal(await page.evaluate(() => window.__loadingSeen), false, 'No loading screen on revisits');
  assert.equal(mealsReads(), 1);
  assert(requests.filter(r => r.docPath.startsWith('meal_images/')).length < 10, 'Do not fetch all historical photos');

  // High-resolution camera JPEGs must be resized, not rejected by pixel count.
  assert.deepEqual(await page.evaluate(async () => {
    const { compressImage } = await import('/src/utils/compressImage.js');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 8000;
    canvas.getContext('2d').fillRect(0, 0, 8000, 8000);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
    canvas.width = canvas.height = 0;
    const result = await compressImage(blob);
    const image = new Image();
    image.src = result;
    await image.decode();
    return [image.width, image.height];
  }), [1000, 1000]);
  // Exercise the older-WebView fallback when bitmap decoding is unavailable.
  assert.equal(await page.evaluate(async () => {
    const { compressImage } = await import('/src/utils/compressImage.js');
    const canvas = document.createElement('canvas');
    canvas.width = 30; canvas.height = 60;
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
    const original = window.createImageBitmap;
    window.createImageBitmap = async () => { throw new Error('unsupported'); };
    try { return (await compressImage(blob)).startsWith('data:image/jpeg;base64,'); }
    finally { window.createImageBitmap = original; }
  }), true);
  // A broken image must reject promptly rather than leave analyzing forever.
  assert.equal(await page.evaluate(async () => {
    const { compressImage } = await import('/src/utils/compressImage.js');
    try { await compressImage(new Blob(['broken'], { type:'image/png' })); return 'unexpected success'; }
    catch (error) { return error.message; }
  }), 'image_decode_failed');
  await page.evaluate(async () => {
    const { reportIncident } = await import('/src/services/telemetry.js');
    reportIncident('render_error', new TypeError('PRIVATE email/photo/token'), { endpoint:'/analyze' });
  });
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('_gramix_incidents_v1') || '[]').length);
  assert(incidents.some(event => event.kind === 'render_error'));
  assert(!JSON.stringify(incidents).includes('PRIVATE'));
  // Fast-forward a stalled provider call; the UI-facing error must not be
  // mistaken for an intentional cancellation.
  await page.clock.install();
  analysisMode = 'timeout';
  const stalledRequest = page.waitForRequest('**/api/analyze');
  await page.evaluate(async () => {
    const { apiFetch } = await import('/src/services/apiClient.js');
    window.__pendingAnalysis = apiFetch('/analyze', { method:'POST', body:JSON.stringify({text:'test'}) }).catch(error => error.name);
  });
  await stalledRequest;
  await page.clock.fastForward(76000);
  assert.equal(await page.evaluate(() => window.__pendingAnalysis), 'TimeoutError');
  await page.clock.resume();
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('_gramix_incidents_v1') || '[]').length);
  assert(incidents.some(event => event.kind === 'analysis_timeout'));
  // Home-screen shortcuts reopen Pages directory URLs with a trailing slash.
  for (const [path, selector] of [['main', '.main-page'], ['stats', '.stats-page'], ['profile', '.profile-page']]) {
    await page.goto(`${base}/${path}/?launch=shortcut#resume`);
    await page.locator(`${selector}:visible`).waitFor({ timeout: 10000 });
    assert.equal(new URL(page.url()).pathname, `/${path}`);
    assert.equal(new URL(page.url()).search, '?launch=shortcut');
    assert.equal(new URL(page.url()).hash, '#resume');
    await page.reload();
    await page.locator(`${selector}:visible`).waitFor({ timeout: 10000 });
    await page.setViewportSize({ width: 390, height: 560 });
    const scrollSelector = path === 'profile' ? '.profile-scroll' : `.${path}-content`;
    const surface = page.locator(`${selector}:visible ${scrollSelector}`);
    await surface.hover();
    await page.mouse.wheel(0, 600);
    await page.waitForFunction(sel => document.querySelector(sel).scrollTop > 0, `${selector} ${scrollSelector}`);
    assert.equal(await page.evaluate(() => document.scrollingElement.scrollTop), 0);
    await page.setViewportSize({ width: 390, height: 844 });
  }
  // New profile actions stay usable within the existing narrow-screen layout.
  await page.locator('.gx-profile-extras button').click();
  await page.locator('.gx-settings textarea').fill('Test feedback from the mocked browser');
  await page.locator('.gx-settings .gx-primary').click();
  await page.waitForFunction(() => document.querySelector('.gx-settings [role=status]')?.textContent.includes('отправлено'));
  await page.keyboard.press('Escape');
  await page.goto(base + '/manual-entry');
  await page.locator('.me-text-input').first().fill('Soup draft');
  await page.locator('.me-ingredient-row input').first().fill('Potato');
  await page.reload();
  assert.equal(await page.locator('.me-text-input').first().inputValue(), 'Soup draft');
  assert.equal(await page.locator('.me-ingredient-row input').first().inputValue(), 'Potato');
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }); window.dispatchEvent(new Event('offline')); });
  await page.locator('.me-text-input').first().fill('Offline soup');
  await page.locator('.me-submit-btn').click();
  assert.match(await page.locator('.gx-draft-status').textContent(), /Нет сети/);
  // Cold offline launch with a restored identity must not wait for API checks.
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }));
  const beforeOffline = requests.length;
  await page.reload();
  assert.equal(await page.locator('.me-text-input').first().inputValue(), 'Offline soup');
  assert.equal(requests.length, beforeOffline, 'Offline draft must not require server reads');
  assert.equal(await page.evaluate(async () => {
    const { loadDraft, saveDraft, clearDraft } = await import('/src/services/drafts.js');
    const uid = window.__testAuth.currentUser.uid;
    const old = { uid, value: localStorage.getItem('gramix_manual_draft_' + uid) };
    const newer = { dishName: 'Newer draft', ingredients: [{ name: 'Rice', weight: '100' }] };
    saveDraft(newer); clearDraft(old);
    if (loadDraft().dishName !== 'Newer draft') return false;
    window.__testAuth.currentUser = { uid: 'other-user' };
    const isolated = loadDraft().dishName === '' && !saveDraft(newer, uid);
    window.__testAuth.currentUser = { uid };
    localStorage.setItem('gramix_manual_draft_' + uid, '{broken');
    const recovered = loadDraft().dishName === '';
    saveDraft(newer); return isolated && recovered;
  }), true);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: '/tmp/gramix-reliability-stats.png' });
  console.log(JSON.stringify({ passed: true, mealListRequests: mealsReads(), imageRequests: requests.filter(r => r.docPath.startsWith('meal_images/')).length, incidents: incidents.length }));
} finally { await browser.close(); }
