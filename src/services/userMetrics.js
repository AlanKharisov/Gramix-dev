// Counters and activity timestamps used by the admin panel. All writes are
// best-effort — failures are logged but never block the user-facing flow.

import { doc, updateDoc, increment, serverTimestamp } from "./firestoreCompat";
import { db } from "../pages/firebase-config";
import { getAccountId } from "./account";

async function safeUpdate(payload) {
  try {
    const accountId = await getAccountId();
    if (!accountId) return;
    await updateDoc(doc(db, "users", accountId), payload);
  } catch (e) {
    console.warn("userMetrics update failed", e);
  }
}

const FIELD_BY_MODE = {
  photo:   "requestsPhoto",
  gallery: "requestsGallery",
  manual:  "requestsManual",
};

export async function trackAnalyzeRequest(mode) {
  const field = FIELD_BY_MODE[mode];
  if (!field) return;
  await safeUpdate({
    [field]: increment(1),
    lastActiveAt: serverTimestamp(),
  });
}

export async function trackIngredientEdit() {
  await safeUpdate({ ingredientEdits: increment(1) });
}

export async function trackMealAdded() {
  await safeUpdate({ mealsCount: increment(1) });
}

export async function trackMealDeleted() {
  await safeUpdate({ mealsCount: increment(-1) });
}

export async function touchLastActive() {
  await safeUpdate({ lastActiveAt: serverTimestamp() });
}
