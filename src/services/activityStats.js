import { localDay } from './stepBudget.js';

// Every total and goal uses the same inclusive calendar-day window.
export function periodWindow(period, selected = new Date(), now = new Date()) {
  const days = ({ day: 1, week: 7, month: 30, year: 365 })[period] || 1;
  const end = new Date(period === 'day' ? selected : now);
  end.setHours(0, 0, 0, 0);
  const start = new Date(end); start.setDate(start.getDate() - days + 1);
  const until = new Date(end); until.setDate(until.getDate() + 1);
  const keys = [];
  for (let date = new Date(start); date < until; date.setDate(date.getDate() + 1)) keys.push(localDay(date));
  return { start, end, until, days, keys };
}

export function diaryAverage(meals, range = periodWindow('week')) {
  const totals = new Map();
  for (const meal of meals) {
    const date = new Date(meal.date), calories = Number(meal.calories);
    if (date < range.start || date >= range.until || !Number.isFinite(date.getTime()) || !Number.isFinite(calories) || calories < 0) continue;
    const key = localDay(date);
    totals.set(key, (totals.get(key) || 0) + calories);
  }
  const recordedDays = totals.size;
  return { value: recordedDays ? Math.round([...totals.values()].reduce((a, b) => a + b, 0) / recordedDays) : null, recordedDays, days: range.days };
}

export function summarizeActivity(history, range) {
  const keys = new Set(range.keys);
  const byDate = new Map();
  for (const day of history || []) {
    if (!keys.has(day.date) || !Number.isSafeInteger(day.steps) || day.steps < 0 || day.steps > 100000 ||
        !Number.isFinite(day.extra) || day.extra < 0 || !Number.isFinite(day.baseGoal) || day.baseGoal <= 0) continue;
    if (!byDate.has(day.date) || (day.updatedAt || 0) >= (byDate.get(day.date).updatedAt || 0)) byDate.set(day.date, day);
  }
  const values = [...byDate.values()];
  return {
    steps: values.reduce((sum, day) => sum + day.steps, 0),
    extra: values.reduce((sum, day) => sum + day.extra, 0),
    activeKcal: values.reduce((sum, day) => sum + (Number(day.activeKcal) || 0), 0),
    recordedDays: values.length, days: range.days,
    partialDays: values.filter(day => day.partial).length,
    byDate,
  };
}
