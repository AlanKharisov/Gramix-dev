import { collection, doc, getDocs, getDoc, setDoc } from "./firestoreCompat";
import { db } from "../pages/firebase-config";

// Local YYYY-MM-DD for a Date.
export function dateKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const SEED_KEY = "1970-01-01";

function pickNorm(rec) {
  return {
    calories: Number(rec?.calories || 0),
    proteins: Number(rec?.proteins || 0),
    fats: Number(rec?.fats || 0),
    carbs: Number(rec?.carbs || 0),
  };
}

// Upsert today's record. If the user changes biometry several times the same
// day, the last value wins — we never need more than one record per day.
export async function appendNormHistory(uid, dailyNorm, extra = {}) {
  if (!uid || !dailyNorm) return;
  const key = dateKey(new Date());
  const payload = {
    effectiveFrom: key,
    ...pickNorm(dailyNorm),
    ...extra,
  };
  await setDoc(
    doc(db, "users", uid, "normHistory", key),
    payload,
    { merge: true },
  );
}

// Load history sorted ascending by effectiveFrom (string sort is correct for ISO dates).
export async function loadNormHistory(uid) {
  if (!uid) return [];
  const snap = await getDocs(collection(db, "users", uid, "normHistory"));
  return snap.docs
    .map((d) => d.data())
    .filter((r) => typeof r.effectiveFrom === "string")
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

// Seed a record with effectiveFrom = epoch so historical days resolve to the
// earliest known norm. Idempotent: skips if the seed slot is already filled.
// If other records already exist (e.g. the user logged biometry today), use
// the earliest of those as the seed value instead of the current dailyNorm —
// otherwise past days would inherit the *new* norm after a change.
export async function ensureSeedNormHistory(uid, dailyNormFallback) {
  if (!uid) return;
  const ref = doc(db, "users", uid, "normHistory", SEED_KEY);
  const existing = await getDoc(ref);
  if (existing.exists()) return;
  const history = await loadNormHistory(uid);
  const earliest = history.find((r) => r.effectiveFrom !== SEED_KEY) || null;
  const source = earliest || dailyNormFallback;
  if (!source) return;
  await setDoc(ref, { effectiveFrom: SEED_KEY, ...pickNorm(source) });
}

// Find the norm in effect for `date`: latest record with effectiveFrom <= date.
// Falls back to `fallback` if history is empty.
export function getNormForDate(history, date, fallback) {
  const key = dateKey(date);
  let chosen = null;
  for (const rec of history) {
    if (rec.effectiveFrom <= key) chosen = rec;
    else break;
  }
  return chosen ? pickNorm(chosen) : pickNorm(fallback);
}

// Sum norms over the last `n` calendar days, ending at `endDate` (inclusive).
// For period totals (week / month / year) on StatsPage.
export function sumNormsForLastNDays(history, n, endDate, fallback) {
  const out = { calories: 0, proteins: 0, fats: 0, carbs: 0 };
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  for (let i = 0; i < n; i++) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const norm = getNormForDate(history, d, fallback);
    out.calories += norm.calories;
    out.proteins += norm.proteins;
    out.fats += norm.fats;
    out.carbs += norm.carbs;
  }
  return out;
}
