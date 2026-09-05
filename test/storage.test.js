import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gramixStorage } from '../src/utils/storage.js';
test('full/unavailable browser storage still supports session settings', () => {
  gramixStorage.set('test-setting', 'ru');
  assert.equal(gramixStorage.get('test-setting'), 'ru');
  gramixStorage.remove('test-setting');
  assert.equal(gramixStorage.get('test-setting'), null);
  assert.equal(gramixStorage.get('not-present'), null);
});
