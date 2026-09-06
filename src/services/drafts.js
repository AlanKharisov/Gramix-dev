import { auth } from '../pages/firebase-config';
const key = (uid) => uid && auth.currentUser?.uid === uid ? 'gramix_manual_draft_' + uid : null;
export function loadDraft(uid = auth.currentUser?.uid) {
  try {
    const draft = JSON.parse(key(uid) ? localStorage.getItem(key(uid)) || 'null' : 'null');
    if (draft && typeof draft.dishName === 'string' && Array.isArray(draft.ingredients) && draft.ingredients.length > 0 && draft.ingredients.every(i => i && typeof i.name === 'string' && ['string', 'number'].includes(typeof i.weight))) return draft;
  } catch { /* A damaged draft must not stop opening the form. */ }
  return { dishName: '', ingredients: [{ name: '', weight: '' }] };
}
export function saveDraft(draft, uid = auth.currentUser?.uid) {
  if (!key(uid)) return false;
  try { localStorage.setItem(key(uid), JSON.stringify(draft)); return true; } catch { return false; }
}
export function clearDraft(snapshot) {
  try {
    // Saving an older result must not erase a newer draft in another window.
    const storageKey = key(snapshot?.uid);
    if (storageKey && localStorage.getItem(storageKey) === snapshot.value) localStorage.removeItem(storageKey);
  } catch { /* ignored */ }
}
