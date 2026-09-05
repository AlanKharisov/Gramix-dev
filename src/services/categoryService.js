import catalog from "../data/catalog.json";
import { db } from "../pages/firebase-config";
import { apiFetch } from "./apiClient";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "./firestoreCompat";

const SUPPORTED_LANGS = ["en", "ru", "uk", "de", "ja", "zh", "pl", "es"];
const FUZZY_THRESHOLD = 0.85;
const BACKEND_TIMEOUT_MS = 5000;

export const UNCATEGORIZED = "uncategorized";

export function normalizeIngredientName(name) {
  return (name || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

const pickLang = (lang) =>
  SUPPORTED_LANGS.includes(lang) ? lang : "en";

let _index = null;

function buildIndex() {
  if (_index) return _index;

  const ingredientByKey = new Map();
  // Schema (real seed): { categories:[{key, names:{en,ru,...}}],
  //                       ingredients:[{key, category, names:{en,ru,...}}] }
  // Stub fallback (legacy flat fields like name_en) is also tolerated.
  const ingName = (item, lang) =>
    (item.names && item.names[lang]) || item[`name_${lang}`] || "";
  const ingCategory = (item) => item.category || item.category_key || "";

  for (const ing of catalog.ingredients || []) {
    if (ing && ing.key) ingredientByKey.set(ing.key, ing);
  }

  const categoryByKey = new Map();
  for (const cat of catalog.categories || []) {
    if (cat && cat.key) categoryByKey.set(cat.key, cat);
  }

  // exactByLang[lang]: Map<normalizedName, ingredientKey>
  // namesByLang[lang]: [{ normalized, key }] for fuzzy
  const exactByLang = {};
  const namesByLang = {};
  for (const lang of SUPPORTED_LANGS) {
    exactByLang[lang] = new Map();
    namesByLang[lang] = [];
  }

  for (const ing of catalog.ingredients || []) {
    if (!ing || !ing.key) continue;
    for (const lang of SUPPORTED_LANGS) {
      const raw = ingName(ing, lang);
      if (!raw) continue;
      const norm = normalizeIngredientName(raw);
      if (!norm) continue;
      if (!exactByLang[lang].has(norm)) {
        exactByLang[lang].set(norm, ing.key);
        namesByLang[lang].push({ normalized: norm, key: ing.key });
      }
    }
  }

  _index = { ingredientByKey, categoryByKey, exactByLang, namesByLang, ingCategory };
  return _index;
}

// Per-user, per-lang alias cache (in-memory, session-scoped).
// Keeps repeated AI-resolved names cheap within one session.
const _aliasCache = new Map();
const aliasKey = (name, lang) => `${lang}::${normalizeIngredientName(name)}`;

function jaroSimilarity(a, b) {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (la === 0 || lb === 0) return 0;

  const matchWindow = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
  const aMatches = new Array(la).fill(false);
  const bMatches = new Array(lb).fill(false);

  let matches = 0;
  for (let i = 0; i < la; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, lb);
    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  return (matches / la + matches / lb + (matches - transpositions) / matches) / 3;
}

function jaroWinkler(a, b) {
  const j = jaroSimilarity(a, b);
  let prefix = 0;
  const max = Math.min(4, a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return j + prefix * 0.1 * (1 - j);
}

function exactLookup(normalized, lang) {
  const idx = buildIndex();
  return idx.exactByLang[lang]?.get(normalized) || null;
}

function fuzzyLookup(normalized, lang) {
  const idx = buildIndex();
  const candidates = idx.namesByLang[lang] || [];
  let bestKey = null;
  let bestScore = 0;
  for (const c of candidates) {
    const score = jaroWinkler(normalized, c.normalized);
    if (score > bestScore) {
      bestScore = score;
      bestKey = c.key;
    }
  }
  if (bestScore >= FUZZY_THRESHOLD) {
    return { key: bestKey, score: bestScore };
  }
  return null;
}

async function backendCategorize(name, lang) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    const data = await apiFetch("/categorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, language: lang }),
      signal: controller.signal,
    });
    if (!data || !data.category_key) return null;
    return {
      ingredientKey: data.ingredient_key || null,
      categoryKey: data.category_key,
      source: data.source || "backend",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function resolveFromCatalogKey(ingredientKey) {
  const idx = buildIndex();
  const ing = idx.ingredientByKey.get(ingredientKey);
  if (!ing) return null;
  return { ingredientKey, categoryKey: idx.ingCategory(ing) };
}

/**
 * Resolve an ingredient name to {ingredientKey, categoryKey, source}.
 * Pipeline: cache → exact (catalog) → fuzzy (catalog) → backend (OFF + AI).
 * Returns null only if backend was unreachable AND no local match was found.
 */
export async function resolveCategory(name, langInput) {
  const lang = pickLang(langInput);
  const normalized = normalizeIngredientName(name);
  if (!normalized) return null;

  const ck = aliasKey(name, lang);
  if (_aliasCache.has(ck)) return _aliasCache.get(ck);

  // Step 1 — exact
  const exactKey = exactLookup(normalized, lang);
  if (exactKey) {
    const cat = resolveFromCatalogKey(exactKey);
    if (cat) {
      const out = { ...cat, source: "exact" };
      _aliasCache.set(ck, out);
      return out;
    }
  }

  // Step 2 — fuzzy
  const fuzzy = fuzzyLookup(normalized, lang);
  if (fuzzy) {
    const cat = resolveFromCatalogKey(fuzzy.key);
    if (cat) {
      const out = { ...cat, source: "fuzzy" };
      _aliasCache.set(ck, out);
      return out;
    }
  }

  // Steps 3+4 — backend (Open Food Facts, then Gemini)
  const fromBackend = await backendCategorize(name, lang);
  if (fromBackend) {
    _aliasCache.set(ck, fromBackend);
    return fromBackend;
  }

  return null;
}

// Localized name for a saved ingredient. If the ingredient was tagged with an
// ingredientKey by the categoriser, look it up in the catalog for the user's
// current language; otherwise fall back to the stored free-form name.
export function getIngredientName(ing, langInput) {
  if (!ing) return "";
  const lang = pickLang(langInput);
  if (ing.ingredientKey) {
    const idx = buildIndex();
    const catalogIng = idx.ingredientByKey.get(ing.ingredientKey);
    if (catalogIng) {
      if (catalogIng.names) return catalogIng.names[lang] || catalogIng.names.en || ing.name || "";
      const flat = catalogIng[`name_${lang}`] || catalogIng.name_en;
      if (flat) return flat;
    }
  }
  return ing.name || "";
}

// Best-effort dish-name localization. Many "dishes" are really a single
// ingredient (user typed "Курица"); if the name matches a catalog ingredient
// in any language, return the localized name. Otherwise return as-is.
export function getDishName(name, langInput) {
  if (!name) return "";
  const lang = pickLang(langInput);
  const norm = normalizeIngredientName(name);
  if (!norm) return name;
  const idx = buildIndex();
  for (const tryLang of SUPPORTED_LANGS) {
    const key = idx.exactByLang[tryLang]?.get(norm);
    if (!key) continue;
    const catalogIng = idx.ingredientByKey.get(key);
    if (catalogIng?.names) {
      return catalogIng.names[lang] || catalogIng.names.en || name;
    }
  }
  return name;
}

export function getCategoryName(categoryKey, langInput) {
  const lang = pickLang(langInput);
  const idx = buildIndex();
  const cat = idx.categoryByKey.get(categoryKey);
  if (cat) {
    if (cat.names) return cat.names[lang] || cat.names.en || categoryKey;
    return cat[`name_${lang}`] || cat.name_en || categoryKey;
  }
  return categoryKey || UNCATEGORIZED;
}

export function listCategoryKeys() {
  const idx = buildIndex();
  return [...idx.categoryByKey.keys()];
}

async function runWithConcurrency(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        out[i] = await worker(items[i], i);
      } catch {
        out[i] = null;
      }
    }
  });
  await Promise.all(runners);
  return out;
}

/**
 * For a single meal: resolve category for each ingredient that doesn't already
 * have one and patch the meal doc. Fire-and-forget from save handlers.
 * Skips entirely if every ingredient already has categoryKey.
 */
export async function categorizeAndPatchMeal(uid, mealId, ingredients, lang) {
  if (!uid || !mealId || !Array.isArray(ingredients) || ingredients.length === 0) return;
  const todo = ingredients
    .map((ing, i) => ({ ing, i }))
    .filter(({ ing }) => !ing?.categoryKey);
  if (todo.length === 0) return;

  const resolved = await runWithConcurrency(todo, 4, async ({ ing }) =>
    resolveCategory(ing.name, lang)
  );

  const next = ingredients.map((ing) => ({ ...ing }));
  let changed = false;
  todo.forEach(({ i }, idx) => {
    const res = resolved[idx];
    if (!res || !res.categoryKey) return;
    next[i].categoryKey = res.categoryKey;
    if (res.ingredientKey) next[i].ingredientKey = res.ingredientKey;
    changed = true;
  });
  if (!changed) return;

  try {
    await updateDoc(doc(db, "users", uid, "meals", mealId), { ingredients: next });
  } catch (e) {
    console.warn("categorizeAndPatchMeal: update failed", e);
  }
}

/**
 * One-shot per-user backfill of legacy meals saved before categorisation
 * shipped. Runs once after which users/{uid}.categoryMigrationDone is set.
 */
export async function runCategoryMigrationOnce(uid, lang) {
  if (!uid) return { ran: false };
  const userRef = doc(db, "users", uid);
  try {
    const userSnap = await getDoc(userRef);
    if (userSnap.exists() && userSnap.data().categoryMigrationDone) {
      return { ran: false };
    }
  } catch {
    // best-effort: if we can't read the flag, skip migration
    return { ran: false };
  }

  let processed = 0;
  let updated = 0;
  try {
    const mealsSnap = await getDocs(collection(db, "users", uid, "meals"));
    const stale = [];
    mealsSnap.forEach((d) => {
      const m = d.data() || {};
      const ings = Array.isArray(m.ingredients) ? m.ingredients : [];
      const hasGap = ings.some((ing) => ing && !ing.categoryKey);
      if (hasGap) stale.push({ id: d.id, ingredients: ings });
    });

    for (const meal of stale) {
      processed++;
      const todo = meal.ingredients
        .map((ing, i) => ({ ing, i }))
        .filter(({ ing }) => !ing?.categoryKey);
      const resolved = await runWithConcurrency(todo, 4, async ({ ing }) =>
        resolveCategory(ing.name, lang)
      );
      const next = meal.ingredients.map((ing) => ({ ...ing }));
      let changed = false;
      todo.forEach(({ i }, idx) => {
        const res = resolved[idx];
        if (!res || !res.categoryKey) return;
        next[i].categoryKey = res.categoryKey;
        if (res.ingredientKey) next[i].ingredientKey = res.ingredientKey;
        changed = true;
      });
      if (changed) {
        try {
          await updateDoc(doc(db, "users", uid, "meals", meal.id), {
            ingredients: next,
          });
          updated++;
        } catch (e) {
          console.warn("migration: update failed", meal.id, e);
        }
      }
    }
  } catch (e) {
    console.warn("migration: scan failed", e);
    return { ran: false, processed, updated };
  }

  try {
    await setDoc(
      userRef,
      { categoryMigrationDone: true, categoryMigrationAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (e) {
    console.warn("migration: flag write failed", e);
  }
  return { ran: true, processed, updated };
}
