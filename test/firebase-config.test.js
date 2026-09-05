import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Execute the actual configuration with SDK boundaries stubbed; no auth/network.
const source = readFileSync(new URL('../src/pages/firebase-config.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replaceAll('import.meta.env', 'env')
  .replaceAll('export const ', 'const ');
for (const native of [false, true]) {
  test(`Firebase OAuth resolver: ${native ? 'native credentials' : 'browser popup'}`, () => {
    const persistence = {}, resolver = {};
    let dependencies;
    runInNewContext(source, {
      env: {}, initializeApp: () => ({}),
      initializeAuth: (_app, options) => { dependencies = options; return {}; },
      indexedDBLocalPersistence: persistence,
      browserPopupRedirectResolver: resolver,
      Capacitor: { isNativePlatform: () => native },
    });
    assert.equal(dependencies.persistence, persistence);
    assert.equal(dependencies.popupRedirectResolver, native ? undefined : resolver);
  });
}
