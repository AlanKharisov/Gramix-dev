export function localDay(now = new Date()) {
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
}

// Product estimate: level walking, net of resting expenditure.
// ACSM's horizontal component implies about 0.5 kcal/kg/km.
// Step length = height * 0.414 is an approximation, not a measured stride.
// Never credit movement already represented in the saved activity multiplier.
export function stepBudget(profile, reading, now = new Date()) {
  const base = Number(profile?.dailyNorm?.calories) || 0;
  const result = { goal: base, extra: 0, activeKcal: 0, steps: 0, eligible: false };
  if (reading?.status !== 'ready' || reading.date !== localDay(now) ||
      reading.timeZone !== Intl.DateTimeFormat().resolvedOptions().timeZone ||
      !Number.isSafeInteger(reading.steps) || reading.steps < 0 || reading.steps > 100000) return result;
  result.steps = reading.steps;
  const weight = Number(profile?.weight), height = Number(profile?.height), age = Number(profile?.age);
  if (!(weight >= 30 && weight <= 300 && height >= 120 && height <= 230 && age >= 18 && age <= 100) ||
      !['male', 'female'].includes(profile.gender)) return result;
  const perStep = 0.5 * weight * (height * 0.414 / 100000);
  result.activeKcal = Math.round(reading.steps * perStep);
  const coefficient = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }[profile.activityLevel];
  if (!coefficient || !['lose', 'gain', 'maintain'].includes(profile.goal)) return result;
  const bmr = 10 * weight + 6.25 * height - 5 * age + (profile.gender === 'male' ? 5 : -161);
  const adjustment = profile.goal === 'lose' ? -500 : profile.goal === 'gain' ? 500 : 0;
  // A manually changed/clinical target is not an automatic activity budget.
  if (Math.abs(base - (Math.round(bmr * coefficient) + adjustment)) > 2) return result;
  // Conservative product allowance for ordinary daily movement within 1.2,
  // plus activity already included above sedentary. No negative adjustment.
  const included = 3000 * perStep + bmr * (coefficient - 1.2);
  result.extra = Math.max(0, Math.round(reading.steps * perStep - included));
  result.goal = base + result.extra;
  result.eligible = true;
  return result;
}
