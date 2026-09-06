import test from 'node:test';
import assert from 'node:assert/strict';
import { accrualBudget, restingEnergy } from '../src/services/accrualBudget.js';
import { localDay } from '../src/services/stepBudget.js';
const user={email:'alankharisov@gmail.com',emailVerified:true};
const profile={weight:70,height:175,age:30,gender:'male',activityLevel:'moderate',goal:'lose',dailyNorm:{calories:2056}};
test('resting estimate is personalized and independent of activity/weight-loss goal',()=>{
  assert.equal(restingEnergy(profile),1648.75);
  assert.equal(restingEnergy({...profile,gender:'female'}),1482.75);
  assert.equal(restingEnergy({...profile,age:12}),null);
  assert.equal(restingEnergy({...profile,weight:NaN}),null);
});
test('accrual starts at midnight, includes sleep and never accumulates refreshes',()=>{
  const midnight=new Date(2026,8,6,0), morning=new Date(2026,8,6,6);
  assert.equal(accrualBudget(user,profile,null,midnight).accrued,0);
  const first=accrualBudget(user,profile,null,morning);
  assert.equal(first.resting,1648.75/4);
  assert.deepEqual(accrualBudget(user,profile,null,morning),first);
  assert.equal(accrualBudget(user,profile,null,new Date(2026,8,7,0)).accrued,0);
  assert.ok(first.accrued-500<0);
});
test('net walking is added once; stale or missing health never invents activity',()=>{
  const now=new Date(2026,8,6,12);
  const reading={status:'ready',date:localDay(now),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,steps:10000};
  const result=accrualBudget(user,profile,reading,now);
  assert.equal(result.movement,254);
  assert.equal(result.accrued,1648.75/2+254);
  assert.equal(accrualBudget(user,profile,{...reading,date:'2026-09-05'},now).movement,0);
  assert.equal(accrualBudget(user,profile,{...reading,status:'permission'},now).hasSteps,false);
});
test('auto is isolated to personal accounts and respects a saved opt-out',()=>{
  assert.equal(accrualBudget({...user,email:'other@example.com'},profile,null).enabled,false);
  assert.equal(accrualBudget(user,{...profile,personalAccrualEnabled:false},null).enabled,false);
  assert.equal(accrualBudget(user,{...profile,height:0},null).enabled,false);
});
test('DST uses actual elapsed hours, not a naive wall-clock fraction', {skip:Intl.DateTimeFormat().resolvedOptions().timeZone!=='Europe/Madrid'},()=>{
  assert.equal(accrualBudget(user,profile,null,new Date(2026,2,29,3)).hours,2);
  assert.equal(accrualBudget(user,profile,null,new Date(2026,9,25,3)).hours,4);
});
