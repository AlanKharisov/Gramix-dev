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
    const user = { uid: 'test-user', email: 'alankharisov@gmail.com', emailVerified: true,
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
  await page.goto(base + '/recommendations');
  await page.locator('.food-totals').waitFor({ timeout: 10000 }).catch(async error => { console.log(page.url(), await page.locator('body').innerText(), errors); throw error; });
  assert.equal(await page.locator('.home-tabbar:visible svg').count(), 3);
  assert.equal(await page.locator('.food-sources li').count(), 1);
  await page.getByRole('button', { name: '7 дней', exact: true }).click();
  assert.equal(await page.locator('.food-sources li').count(), 3);
  await page.locator('.food-reduction select').selectOption('20');
  assert.match(await page.locator('.food-sources li').first().innerText(), /40/);
  for (const lang of ['ru', 'en', 'uk', 'de', 'es', 'pl', 'ja', 'zh']) {
    await page.evaluate(async lang => { const { default: i18n } = await import('/src/i18n/index.js'); await i18n.changeLanguage(lang); }, lang);
    assert.equal(await page.locator('.home-tabbar:visible svg').count(), 3);
    assert.equal(await page.locator('.recommendations-page').evaluate(el => el.scrollWidth <= el.clientWidth), true);
    assert.ok(!(await page.locator('.recommendations-page').innerText()).includes('food_'));
  }
  await page.evaluate(async () => { const { default: i18n } = await import('/src/i18n/index.js'); await i18n.changeLanguage('ru'); });
  const logo = await page.locator('.main-header-text:visible').boundingBox();
  assert.ok(Math.abs(logo.x + logo.width / 2 - 195) < 2);
  await page.screenshot({ path: '/tmp/gramix-recommendations.png' });
  for (const index of [0, 1, 2]) {
    await page.locator('.home-tabbar:visible button').nth(index).click();
    await page.waitForTimeout(350);
    assert.equal(await page.locator('.home-tabbar:visible svg').count(), 3);
  }
  await page.evaluate(() => { window.__testAuth.currentUser.email = 'other@example.com'; });
  await page.locator('.home-tabbar:visible button').first().click();
  await page.waitForTimeout(350);
  assert.equal(await page.locator('.home-tabbar:visible button').count(), 2);
  assert.deepEqual(errors, []);
  console.log('PASS: food totals, portions, eight languages, icons, centered logo, navigation and account gate');
} finally { await browser.close(); }
