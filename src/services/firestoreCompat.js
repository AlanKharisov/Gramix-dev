import { apiFetch } from "./apiClient";
import { auth } from '../pages/firebase-config';
import { ReadCache } from './readCache';

const reads = new ReadCache();
export function clearReadCache() { reads.clear(); }
auth.onAuthStateChanged(() => reads.clear());
const key = (uid, kind, path) => `${uid}:${kind}:${path}`;
function invalidate(uid, path) {
  reads.remove(key(uid, 'document', path));
  reads.remove(key(uid, 'collection', path.split('/').slice(0, -1).join('/')));
}
async function read(kind, path, force = false) {
  await auth.authStateReady?.();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('authentication_required');
  const value = await reads.get(key(uid, kind, path), () => apiFetch(`/${kind}?${new URLSearchParams({ path })}`), force);
  if (auth.currentUser?.uid !== uid) throw new Error('account_changed');
  return value;
}

const normalize = (parts) =>
  parts
    .flatMap((part) => String(part || "").split("/"))
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");

const randomId = () => {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID().replaceAll("-", "");
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
};

const refPath = (base, segments) => {
  if (base?.__ref) return normalize([base.path, ...segments]);
  return normalize(segments);
};

export const getFirestore = () => ({ __apiDb: true });

export function doc(base, ...segments) {
  let path = refPath(base, segments);
  if (base?.__ref === "collection" && segments.length === 0) {
    path = normalize([base.path, randomId()]);
  }
  return { __ref: "document", path, id: path.split("/").at(-1) };
}

export function collection(base, ...segments) {
  const path = refPath(base, segments);
  return { __ref: "collection", path, id: path.split("/").at(-1) };
}

class DocumentSnapshot {
  constructor(id, exists, data) {
    this.id = id;
    this._exists = exists;
    this._data = data;
  }
  exists() { return this._exists; }
  data() { return this._data; }
}

class QuerySnapshot {
  constructor(documents) {
    this.docs = documents.map((item) => new DocumentSnapshot(item.id, true, item.data));
    this.empty = this.docs.length === 0;
    this.size = this.docs.length;
  }
  forEach(callback, thisArg) { this.docs.forEach(callback, thisArg); }
}

export async function getDoc(ref, options = {}) {
  const result = await read('document', ref.path, options.fresh);
  return new DocumentSnapshot(result.id || ref.id, result.exists === true, result.data || undefined);
}

export async function getDocs(ref) {
  const result = await read('collection', ref.path);
  return new QuerySnapshot(result.documents || []);
}

export async function setDoc(ref, data, options = {}) {
  const uid = auth.currentUser?.uid;
  const result = await apiFetch(`/document?${new URLSearchParams({ path: ref.path })}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, merge: options.merge === true }),
  });
  invalidate(uid, ref.path);
  if (auth.currentUser?.uid === uid) reads.put(key(uid, 'document', ref.path), { id: ref.id, exists: true, data: result.data });
}

export async function updateDoc(ref, data) {
  await setDoc(ref, data, { merge: true });
}

export async function deleteDoc(ref) {
  const uid = auth.currentUser?.uid;
  await apiFetch(`/document?${new URLSearchParams({ path: ref.path })}`, { method: "DELETE" });
  invalidate(uid, ref.path);
}

export const serverTimestamp = () => ({ __op: "serverTimestamp" });
export const increment = (value) => ({ __op: "increment", value });
export const arrayUnion = (...values) => ({ __op: "arrayUnion", values });

export function writeBatch() {
  const operations = [];
  return {
    set(ref, data, options = {}) {
      operations.push({ type: "set", path: ref.path, data, merge: options.merge === true });
      return this;
    },
    update(ref, data) {
      operations.push({ type: "update", path: ref.path, data, merge: true });
      return this;
    },
    delete(ref) {
      operations.push({ type: "delete", path: ref.path });
      return this;
    },
    async commit() {
      const uid = auth.currentUser?.uid;
      await apiFetch("/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operations }),
      });
      for (const operation of operations) invalidate(uid, operation.path);
    },
  };
}

export function onSnapshot(ref, callback, onError) {
  let stopped = false;
  let previous = null;
  let timer;
  const poll = async () => {
    if (stopped) return;
    try {
      if (document.hidden) return;
      const snapshot = await getDoc(ref, { fresh: true });
      if (stopped) return;
      const serialized = JSON.stringify(snapshot.data() || null);
      if (serialized !== previous) {
        previous = serialized;
        callback(snapshot);
      }
    } catch (error) {
      onError?.(error);
    } finally {
      if (!stopped) timer = setTimeout(poll, 30000);
    }
  };
  poll();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
