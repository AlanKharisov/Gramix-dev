import { periodWindow } from './activityStats.js';

const nonnegative = value => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
// Summarize recorded food only; missing days are never treated as zero intake.
export function foodSummary(meals, period = 'day', now = new Date()) {
  const range = periodWindow(period, now, now);
  const totals = { calories: 0, protein: 0, fat: 0, carbs: 0 };
  const dishes = new Map(), days = new Set();
  let count = 0;
  for (const meal of meals) {
    const date = new Date(meal.date);
    if (!Number.isFinite(date.getTime()) || date < range.start || date >= range.until || date > now) continue;
    count++;
    days.add(date.toDateString());
    for (const key of Object.keys(totals)) totals[key] += nonnegative(meal[key]);
    const name = typeof meal.name === 'string' ? meal.name.trim() : '';
    if (!name) continue;
    const key = name.toLocaleLowerCase();
    const item = dishes.get(key) || { name, calories: 0, count: 0 };
    item.calories += nonnegative(meal.calories); item.count++;
    dishes.set(key, item);
  }
  return { totals, count, recordedDays: days.size, days: range.days,
    dishes: [...dishes.values()].filter(item => item.calories > 0).sort((a, b) => b.calories - a.calories).slice(0, 3) };
}
