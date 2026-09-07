import test from 'node:test';import assert from 'node:assert/strict';
import {averageBalance} from '../src/services/healthBalance.js';
import {accrualBudget} from '../src/services/accrualBudget.js';
test('balance average uses completed days with food and both energy metrics, never food average',()=>{
  const meals=[{date:'2026-09-06T12:00:00',calories:2500},{date:'2026-09-05T12:00:00',calories:1700}];
  const days=[{day:'2026-09-06',resting:1600,active:500,complete:1},{day:'2026-09-05',resting:1600,active:300,complete:1},{day:'2026-09-04',resting:1600,active:0,complete:1}];
  assert.deepEqual(averageBalance(meals,days,new Date(2026,8,7,12)),{value:-100,recordedDays:2,days:7});
  assert.equal(averageBalance(meals,[],new Date(2026,8,7)).value,null);
});
test('imported active energy replaces, never adds to, native walking estimate',()=>{
  const now=new Date(2026,8,7,12),user={email:'alankharisov@gmail.com',emailVerified:true},profile={weight:70,height:175,age:30,gender:'male'};
  const reading={status:'ready',date:'2026-09-07',steps:10000,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone};
  assert.equal(accrualBudget(user,profile,reading,now,{day:'2026-09-07',active:400,synced_at:Date.now()}).movement,400);
  assert.equal(accrualBudget(user,{...profile,personalActivityMode:'manual'},reading,now).enabled,false);
});
