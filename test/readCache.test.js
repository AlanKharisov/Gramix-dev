import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReadCache } from '../src/services/readCache.js';

test('parallel and repeated reads share work; callers cannot mutate cached data', async () => {
  const cache = new ReadCache();
  let calls = 0;
  const load = async () => { calls++; return { meals: [1] }; };
  const [a, b] = await Promise.all([cache.get('a', load), cache.get('a', load)]);
  a.meals.push(2);
  assert.deepEqual(b.meals, [1]);
  assert.deepEqual(await cache.get('a', load), { meals: [1] });
  assert.equal(calls, 1);
});

test('invalidated in-flight read cannot overwrite a newer write', async () => {
  const cache = new ReadCache();
  let resolve;
  const old = cache.get('a', () => new Promise(done => { resolve = done; }));
  await Promise.resolve();
  cache.put('a', { value: 'new' });
  resolve({ value: 'old' });
  await old;
  assert.equal((await cache.get('a', () => {})).value, 'new');
});

test('clear invalidates pending results and isolates accounts', async () => {
  const cache = new ReadCache();
  let resolve;
  const pending = cache.get('user-a:meals', () => new Promise(done => { resolve = done; }));
  await Promise.resolve();
  cache.clear();
  resolve(['secret-a']); await pending;
  assert.equal(cache.entries.size, 0);
  assert.deepEqual(await cache.get('user-b:meals', async () => ['b']), ['b']);
});

test('cache enforces memory budget and expired entries refetch', async () => {
  const cache = new ReadCache({ maxBytes: 40, ttl: 0 });
  cache.put('a', '1234567890'); cache.put('b', '1234567890');
  assert(cache.bytes <= 40);
  assert.equal(cache.entries.size, 1);
  assert.equal(await cache.get('b', async () => 'fresh'), 'fresh');
});
