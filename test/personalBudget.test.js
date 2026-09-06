import test from 'node:test';
import assert from 'node:assert/strict';
import { isPersonalBudget, personalAverage } from '../src/services/personalBudget.js';
test('personal display is limited to two verified accounts', () => {
  for (const email of ['alankharisov@gmail.com','alankharisov1@gmail.com']) assert.equal(isPersonalBudget({email,emailVerified:true}),true);
  assert.equal(isPersonalBudget({email:'alankharisov@gmail.com',emailVerified:false}),false);
  assert.equal(isPersonalBudget({email:'other@gmail.com',emailVerified:true}),false);
  assert.equal(isPersonalBudget(null),false);
});
test('30-day average requires thirty recorded days, otherwise seven', () => {
  const now=new Date(2026,8,6,12);
  const meals=Array.from({length:30},(_,i)=>({date:new Date(2026,8,6-i,12),calories:2000}));
  assert.equal(personalAverage(meals,now).days,30);
  assert.equal(personalAverage(meals.slice(0,29),now).days,7);
  assert.equal(personalAverage([],now).value,null);
});
