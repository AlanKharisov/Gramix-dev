import { periodWindow } from './activityStats.js';
import { localDay } from './stepBudget.js';
import { stepBudget } from './stepBudget.js';
import { restingEnergy } from './accrualBudget.js';

// Completed calendar days only. Missing movement is not zero movement.
export function averageExpenditure(profile, healthDays, now = new Date()) {
  const end = new Date(now); end.setDate(end.getDate() - 1);
  const restEstimate = restingEnergy(profile);
  const calculate = period => {
    const range = periodWindow(period, end, end), keys = new Set(range.keys), totals = new Map();
    for (const row of healthDays || []) {
      if (!keys.has(row.day)) continue;
      const date = new Date(row.day + 'T12:00:00');
      // A day imported before it ended is still a partial sample.
      if (!row.complete && !(Number.isFinite(row.synced_at) && localDay(new Date(row.synced_at)) > row.day)) continue;
      const activeValid = Number.isFinite(row.active) && row.active >= 0 && row.active <= 10000;
      const stepsValid = Number.isSafeInteger(row.steps) && row.steps >= 0 && row.steps <= 100000;
      const restValid = Number.isFinite(row.resting) && row.resting > 0 && row.resting <= 10000;
      if ((!activeValid && !(stepsValid && restEstimate !== null)) || (!restValid && restEstimate === null)) continue;
      const movement = activeValid ? row.active : stepBudget(profile, {status:'ready', date:row.day, steps:row.steps, timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone}, date).activeKcal;
      totals.set(row.day, {value:(restValid ? row.resting : restEstimate) + movement, estimated:!restValid || !activeValid});
    }
    const values = [...totals.values()];
    return {value:values.length ? Math.round(values.reduce((sum,row)=>sum+row.value,0)/values.length) : null, recordedDays:values.length, days:range.days, estimated:values.some(row=>row.estimated)};
  };
  const month = calculate('month');
  return month.recordedDays === 30 ? month : calculate('week');
}
export function averageBalance(meals,healthDays,now=new Date()) {
  // Completed days only; today's partial intake/expenditure is not a full day.
  const end=new Date(now);end.setDate(end.getDate()-1);
  const totals=new Map();for(const meal of meals){const date=new Date(meal.date),kcal=Number(meal.calories);if(Number.isFinite(date.getTime())&&Number.isFinite(kcal)&&kcal>=0)totals.set(localDay(date),(totals.get(localDay(date))||0)+kcal);}
  const calculate=period=>{
    const range=periodWindow(period,end,end),keys=new Set(range.keys),balances=new Map();
    for(const row of healthDays||[]){if(keys.has(row.day)&&row.complete&&Number.isFinite(row.resting)&&Number.isFinite(row.active)&&row.resting>=0&&row.active>=0&&totals.has(row.day))balances.set(row.day,row.resting+row.active-totals.get(row.day));}
    return {value:balances.size?Math.round([...balances.values()].reduce((a,b)=>a+b,0)/balances.size):null,recordedDays:balances.size,days:range.days};
  };
  const month=calculate('month');return month.recordedDays===30?month:calculate('week');
}
