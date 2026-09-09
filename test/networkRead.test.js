import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchWithReadRetry} from '../src/services/networkRead.js';
import {cacheImage} from '../src/services/imageCache.js';
test('a failed GET retries once; persistent failure is still surfaced', async()=>{
  let calls=0;
  assert.equal(await fetchWithReadRetry('/read',{},async()=>{if(++calls===1)throw new TypeError('network');return 'ok';}),'ok');
  assert.equal(calls,2);calls=0;
  await assert.rejects(fetchWithReadRetry('/read',{},async()=>{calls++;throw new TypeError('network');}));
  assert.equal(calls,2);
});
test('writes, aborts and HTTP errors are never replayed',async()=>{
  for(const method of ['POST','PUT','DELETE','PATCH']){
    let calls=0;await assert.rejects(fetchWithReadRetry('/meal',{method},async()=>{calls++;throw new TypeError('network');}));assert.equal(calls,1);
  }
  const controller=new AbortController();let calls=0;
  await assert.rejects(fetchWithReadRetry('/read',{signal:controller.signal},async()=>{calls++;controller.abort();throw new TypeError('network');}));assert.equal(calls,1);
  const response=new Response('',{status:503});calls=0;
  assert.equal(await fetchWithReadRetry('/read',{},async()=>{calls++;return response;}),response);assert.equal(calls,1);
});
test('photo cache enforces byte and entry budgets without changing the input',()=>{
  const first={a:'12345'};
  assert.deepEqual(cacheImage(first,'b','123456',20),{b:'123456'});
  assert.deepEqual(first,{a:'12345'});
  assert.deepEqual(cacheImage({},'huge','12345',4),{});
  let cache={};for(let i=0;i<20;i++)cache=cacheImage(cache,String(i),'a');
  assert.equal(Object.keys(cache).length,8);
});
