import { db } from "../pages/firebase-config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
} from "./firestoreCompat";
import { getAccountId } from "./account";

const normalizeName = (name) =>
  (name || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");

const docIdFor = (name, lang) => {
  const slug = normalizeName(name).replace(/\s/g, "_").slice(0, 120);
  return slug ? `${lang || "ru"}__${slug}` : null;
};

const productsCollection = (accountId) => collection(db, "users", accountId, "products");

export async function learnIngredient(ing, lang, taxonomy) {
  const accountId = await getAccountId();
  if (!accountId) return;

  const weight = Number(ing.weight_g ?? ing.weight ?? ing.grams ?? 0);
  if (!weight || weight <= 0) return;
  const name = (ing.name || "").toString().trim();
  if (!name) return;

  const id = docIdFor(name, lang);
  if (!id) return;

  const cal = Number(ing.calories ?? ing.cal ?? 0);
  const p = Number(ing.protein ?? ing.p ?? 0);
  const f = Number(ing.fat ?? ing.f ?? 0);
  const c = Number(ing.carbs ?? ing.c ?? 0);

  try {
    const ref = doc(productsCollection(accountId), id);
    const snap = await getDoc(ref);
    if (snap.exists()) return;
    const payload = {
      name,
      normalizedName: normalizeName(name),
      language: lang || "ru",
      sampleWeight: weight,
      calories: cal,
      protein: p,
      fat: f,
      carbs: c,
      calPerGram: cal / weight,
      proteinPerGram: p / weight,
      fatPerGram: f / weight,
      carbsPerGram: c / weight,
      createdAt: serverTimestamp(),
    };
    if (taxonomy?.ingredientKey) payload.ingredientKey = taxonomy.ingredientKey;
    if (taxonomy?.categoryKey) payload.categoryKey = taxonomy.categoryKey;
    await setDoc(ref, payload);
  } catch (e) {
    console.warn("learnIngredient failed", e);
  }
}

export async function learnIngredients(ingredients, lang, taxonomies) {
  if (!Array.isArray(ingredients) || ingredients.length === 0) return;
  await Promise.all(
    ingredients.map((ing, i) =>
      learnIngredient(ing, lang, Array.isArray(taxonomies) ? taxonomies[i] : undefined)
    )
  );
}

export async function fetchLearnedProductNames() {
  const accountId = await getAccountId();
  if (!accountId) return [];
  try {
    const snap = await getDocs(productsCollection(accountId));
    return snap.docs.map((d) => d.data().name).filter(Boolean);
  } catch {
    return [];
  }
}
