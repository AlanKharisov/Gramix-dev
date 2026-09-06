import test from 'node:test';
import assert from 'node:assert/strict';
import { periodWindow, diaryAverage, summarizeActivity } from '../src/services/activityStats.js';
const now = new Date(2026, 8, 6, 12);
test('periods contain exactly 1, 7, 30 and 365 local dates', () => {
  for (const [period, n] of [['day',1],['week',7],['month',30],['year',365]]) {
    const range = periodWindow(period, now, now);
    assert.equal(range.keys.length, n); assert.equal(range.keys.at(-1), '2026-09-06');
    assert.equal(range.start.getHours(), 0); assert.equal(range.until.getHours(), 0);
  }
});
test('average is per recorded day, not per meal; missing days stay unknown', () => {
  const meals = [
    { date: new Date(2026,8,6,8), calories: 500 }, { date: new Date(2026,8,6,12), calories: 1000 },
    { date: new Date(2026,8,4,12), calories: 2500 }, { date: new Date(2026,7,1,12), calories: 9000 },
  ];
  assert.deepEqual(diaryAverage(meals, periodWindow('week',now,now)), { value: 2000, recordedDays: 2, days: 7 });
  assert.equal(diaryAverage([], periodWindow('week',now,now)).value, null);
});
test('history uses latest daily snapshot once and does not fabricate missing days', () => {
  const day = { date:'2026-09-06', steps:5000, baseGoal:2000, extra:100, activeKcal:150, updatedAt:1 };
  const result = summarizeActivity([day,{...day,steps:6000,extra:120,updatedAt:2},{...day,date:'2026-08-01'}],periodWindow('week',now,now));
  assert.equal(result.steps,6000); assert.equal(result.extra,120); assert.equal(result.recordedDays,1); assert.equal(result.days,7);
  assert.equal(summarizeActivity([day],periodWindow('day',new Date(2026,8,5),now)).recordedDays,0);
});
