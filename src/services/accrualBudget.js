import { localDay, stepBudget } from './stepBudget.js';
import { isPersonalBudget } from './personalBudget.js';

// Mifflin–St Jeor resting energy estimate, not TDEE or a meal allowance.
export function restingEnergy(profile) {
  const weight = Number(profile?.weight), height = Number(profile?.height), age = Number(profile?.age);
  if (!(weight >= 30 && weight <= 300 && height >= 120 && height <= 230 && age >= 18 && age <= 100) ||
      !['male', 'female'].includes(profile?.gender)) return null;
  return 10 * weight + 6.25 * height - 5 * age + (profile.gender === 'male' ? 5 : -161);
}

export function accrualBudget(user, profile, reading, now = new Date()) {
  const requested = isPersonalBudget(user) && profile?.personalAccrualEnabled !== false;
  const daily = restingEnergy(profile);
  if (!requested || daily === null || !Number.isFinite(now.getTime())) return { enabled: false, invalid: requested && daily === null };
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
  // Actual elapsed time keeps the hourly rate constant across 23/25-hour DST days.
  // Recompute instead of incrementing a counter: resume/reload cannot double-credit.
  const hours = Math.max(0, (now - midnight) / 3600000);
  const resting = daily * hours / 24;
  // Walking energy is net of resting expenditure. Do not also add an activity
  // multiplier, ordinary step allowance, or diet-goal adjustment.
  const movement = stepBudget(profile, reading, now).activeKcal;
  const hasSteps = reading?.status === 'ready' && reading.date === localDay(now) &&
    reading.timeZone === Intl.DateTimeFormat().resolvedOptions().timeZone && Number.isSafeInteger(reading.steps) && reading.steps >= 0 && reading.steps <= 100000;
  return { enabled: true, invalid: false, daily, hourly: daily / 24, hours,
    resting, movement, accrued: resting + movement, hasSteps, partial: Boolean(reading?.partial) };
}
