import { periodWindow } from './activityStats.js';
import { localDay } from './stepBudget.js';
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
