import { auth } from "../pages/firebase-config";
import { apiFetch } from "./apiClient";

const cacheKey = (uid) => `_cs_account_id_${uid}`;

let currentAccountId = null;
let currentFirebaseUid = null;
const inflightByUid = new Map();

function loadFromCache(uid) {
  try { return localStorage.getItem(cacheKey(uid)) || null; } catch { return null; }
}

function saveToCache(uid, publicId) {
  try { localStorage.setItem(cacheKey(uid), publicId); } catch { /* ignore */ }
}

async function resolveAccount(firebaseUser) {
  const cached = loadFromCache(firebaseUser.uid);
  const account = await apiFetch("/account");
  const publicId = account.publicId || cached;
  if (!publicId) throw new Error("account_id_missing");
  saveToCache(firebaseUser.uid, publicId);
  if (auth.currentUser?.uid !== firebaseUser.uid) throw new Error('account_changed');
  currentFirebaseUid = firebaseUser.uid;
  currentAccountId = publicId;
  return publicId;
}

export async function ensureAccount(firebaseUser) {
  if (!firebaseUser) return null;
  if (currentFirebaseUid === firebaseUser.uid && currentAccountId) return currentAccountId;
  if (inflightByUid.has(firebaseUser.uid)) return inflightByUid.get(firebaseUser.uid);
  const promise = resolveAccount(firebaseUser).finally(() => { if (inflightByUid.get(firebaseUser.uid) === promise) inflightByUid.delete(firebaseUser.uid); });
  inflightByUid.set(firebaseUser.uid, promise);
  return promise;
}

export async function getAccountId() {
  const user = auth.currentUser;
  if (!user) return null;
  if (currentFirebaseUid === user.uid && currentAccountId) return currentAccountId;
  return ensureAccount(user);
}

export function clearAccountCache() {
  if (currentFirebaseUid) {
    try { localStorage.removeItem(cacheKey(currentFirebaseUid)); } catch { /* ignore */ }
  }
  currentAccountId = null;
  currentFirebaseUid = null;
  inflightByUid.clear();
}

export async function accountIdForFirebaseUid(firebaseUid) {
  const user = auth.currentUser;
  if (!user || user.uid !== firebaseUid) return null;
  return ensureAccount(user);
}
