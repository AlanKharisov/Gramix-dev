import test from 'node:test';
import assert from 'node:assert/strict';
import { stepBudget, localDay } from '../src/services/stepBudget.js';
import { stepTranslations } from '../src/i18n/steps.js';
import { extras } from '../src/i18n/extras.js';

const now = new Date(2026, 8, 6, 14);
const profile = { weight: 70, height: 175, age: 30, gender: 'male', goal: 'maintain', activityLevel: 'sedentary', dailyNorm: { calories: 1979 } };
const reading = { date: localDay(now), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, status: 'ready', steps: 10000 };
test('walking updates the goal without accumulating the same reading twice', () => {
  const budget = stepBudget(profile, reading, now);
  assert.equal(budget.activeKcal, 254);
  assert.equal(budget.extra, 178);
  assert.equal(budget.goal, 2157);
  assert.deepEqual(stepBudget(profile, reading, now), budget);
  assert.equal(stepBudget(profile, { ...reading, steps: 12000 }, now).extra, 228);
});
test('already included activity, clinical targets and invalid profiles get no extra credit', () => {
  assert.equal(stepBudget({ ...profile, activityLevel: 'moderate', dailyNorm: { calories: 2556 } }, reading, now).extra, 0);
  for (const change of [{ age: 12 }, { weight: 0 }, { height: 0 }, { dailyNorm: { calories: 1500 } }]) {
    assert.equal(stepBudget({ ...profile, ...change }, reading, now).extra, 0);
  }
});
test('midnight, wrong zone, missing permission and corrupt readings keep the base goal', () => {
  for (const change of [{ date: '2026-09-05' }, { timeZone: 'invalid' }, { status: 'error' },
    { status: 'permission' }, { steps: -10 }, { steps: NaN }, { steps: 100001 }, { steps: 1.5 }]) {
    assert.equal(stepBudget(profile, { ...reading, ...change }, now).goal, profile.dailyNorm.calories);
  }
});
test('all eight languages have nonempty feature labels and no cancelled features', () => {
  for (const lang of ['en','ru','uk','de','es','pl','ja','zh']) {
    for (const [key, text] of Object.entries(stepTranslations.en)) {
      assert.equal(typeof stepTranslations[lang][key], typeof text);
      assert(stepTranslations[lang][key].length);
    }
    assert(extras[lang].x_draft); assert(extras[lang].x_feedback);
    assert(!extras[lang].x_reminders);
  }
});
