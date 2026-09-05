const PREFIX = "gramix_";
const memory = new Map();

const MIGRATIONS = [
  ["caloriesnap_lang", "gramix_lang"],
  ["caloriesnap_verified_uid", "gramix_verified_uid"],
  ["caloriesnap_last_route", "gramix_last_route"],
  ["caloriesnap_policy_accepted", "gramix_policy_accepted"],
];

const MIGRATION_FLAG = "gramix_storage_migrated";

function prefix(key) {
  return PREFIX + key;
}

function runMigration() {
  if (typeof window === "undefined" || !window.localStorage) return;
  if (localStorage.getItem(MIGRATION_FLAG) === "1") return;

  MIGRATIONS.forEach(([oldKey, newKey]) => {
    const value = localStorage.getItem(oldKey);
    if (value !== null) {
      localStorage.setItem(newKey, value);
      localStorage.removeItem(oldKey);
    }
  });

  localStorage.setItem(MIGRATION_FLAG, "1");
}

export const STORAGE_KEYS = {
  LANG: "lang",
  VERIFIED_UID: "verified_uid",
  LAST_ROUTE: "last_route",
  POLICY_ACCEPTED: "policy_accepted",
};

export const gramixStorage = {
  get(key) {
    if (memory.has(key)) return memory.get(key);
    try { runMigration(); return localStorage.getItem(prefix(key)); }
    catch { return null; }
  },
  set(key, value) {
    memory.set(key, String(value));
    try { runMigration(); localStorage.setItem(prefix(key), value); }
    catch { /* A full/restricted disk must not crash navigation. */ }
  },
  remove(key) {
    memory.set(key, null);
    try { runMigration(); localStorage.removeItem(prefix(key)); }
    catch { /* Session fallback already removed the value. */ }
  },
};
