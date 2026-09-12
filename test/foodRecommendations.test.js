import test from 'node:test';
import assert from 'node:assert/strict';
import { foodSummary } from '../src/services/foodRecommendations.js';
import { recommendationTranslations } from '../src/i18n/recommendations.js';
const now = new Date(2026, 8, 12, 18);
const date = new Date(2026, 8, 12, 12).toISOString();
test('food totals use the same local period, aggregate dishes and omit invalid/future dates', () => {
  const result = foodSummary([
    { date, name: 'Rice', calories: 200, protein: 5 },
    { date, name: ' rice ', calories: 100, protein: -3 },
    { date: 'invalid', name: 'Bad', calories: 900 },
    { date: new Date(2026, 8, 13).toISOString(), calories: 900 },
    { date: new Date(2026, 8, 11, 12).toISOString(), calories: 800 },
  ], 'day', now);
  assert.equal(result.totals.calories, 300);
  assert.equal(result.totals.protein, 5);
  assert.equal(result.count, 2);
  assert.equal(result.recordedDays, 1);
  assert.deepEqual(result.dishes, [{ name: 'Rice', calories: 300, count: 2 }]);
});
test('missing days are not counted and malformed nutrition cannot poison totals', () => {
  const result = foodSummary([{ date, name: 'Food', calories: 100, fat: 'bad', carbs: Infinity }], 'week', now);
  assert.equal(result.days, 7); assert.equal(result.recordedDays, 1);
  assert.equal(result.totals.fat, 0); assert.equal(result.totals.carbs, 0);
  assert.equal(foodSummary([], 'day', now).count, 0);
});
test('recommendations and photo errors have complete translations in every supported language', () => {
  assert.equal(Object.keys(recommendationTranslations).length, 8);
  const keys = Object.keys(recommendationTranslations.en).sort();
  for (const strings of Object.values(recommendationTranslations)) {
    assert.deepEqual(Object.keys(strings).sort(), keys);
    for (const key of keys) {
      assert.ok(typeof strings[key] === 'string' && strings[key].trim());
      assert.deepEqual(strings[key].match(/{{\w+}}/g)?.sort(), recommendationTranslations.en[key].match(/{{\w+}}/g)?.sort());
    }
  }
});
