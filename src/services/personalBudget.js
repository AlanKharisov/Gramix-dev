import { diaryAverage, periodWindow } from './activityStats.js';

// Presentation preference only. Never grants access to data or admin APIs.
export function isPersonalBudget(user) {
  return user?.emailVerified === true && ['alankharisov@gmail.com', 'alankharisov1@gmail.com'].includes(user.email?.trim().toLowerCase());
}
export function personalAverage(meals, now = new Date()) {
  const month = diaryAverage(meals, periodWindow('month', now, now));
  return month.recordedDays === 30 ? month : diaryAverage(meals, periodWindow('week', now, now));
}
