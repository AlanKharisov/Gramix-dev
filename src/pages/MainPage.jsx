import React, { useState, useEffect, useEffectEvent } from "react";
import { useLocation } from "react-router-dom";
import { useNavigate } from '../hooks/useAppNavigate';
import { useTranslation } from "react-i18next";
import { auth, db } from "./firebase-config";
import { useSwipeNavigation } from "../hooks/useSwipeNavigation";
import AddMealSheet from '../components/AddMealSheet';
import { clearDraft } from '../services/drafts';
import { useStepBudget } from '../hooks/useStepBudget';
import CalorieOverview from '../components/CalorieOverview';
import { averageExpenditure } from '../services/healthBalance';
import { useHealthImport } from '../hooks/useHealthImport';
import { localDay } from '../services/stepBudget';
import { useHourlyBudget } from '../hooks/useHourlyBudget';
import { useAccrualBudget } from '../hooks/useAccrualBudget';
import { diaryAverage, periodWindow } from '../services/activityStats';
import { useDailyQuota } from "../hooks/useDailyQuota";
import { useBackHandler } from "../hooks/useBackHandler";
import { learnIngredients, learnIngredient } from "../services/productService";
import { categorizeAndPatchMeal, getIngredientName, getDishName } from "../services/categoryService";
import { ensureAccount, getAccountId } from "../services/account";
import {
  trackAnalyzeRequest,
  trackIngredientEdit,
  trackMealAdded,
  trackMealDeleted,
} from "../services/userMetrics";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
} from "../services/firestoreCompat";
import { StatusBar, Style } from "@capacitor/status-bar";
import RingProgress from "../components/RingProgress";
import BottomSheetPopup from "../components/BottomSheetPopup";
import MealThumbnail from '../components/MealThumbnail';
import LoadError from '../components/LoadError';
import { compressImage } from '../utils/compressImage';
import { reportIncident } from '../services/telemetry';
import { Capacitor } from '@capacitor/core';
import { captureNativePhoto, subscribeRestoredPhoto } from '../services/photoCapture';
import { apiFetch } from "../services/apiClient";
import { gramixStorage, STORAGE_KEYS } from "../utils/storage";
import "./main.css";
import "./meal-detail.css";
import "./onboarding.css";
import errorPlateImg from "../assets/gramix-preview.webp";

const PAGE_ORDER = ["/main", "/stats"];

const Icons = {
  Profile: () => (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  ),
  Camera: () => (
    <svg viewBox="0 0 512 512" width="32" height="32" fill="currentColor">
      <path d="M149.1 64.8L138.7 96H64C28.7 96 0 124.7 0 160V416c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V160c0-35.3-28.7-64-64-64H373.3L362.9 64.8C356.4 45.2 338.1 32 317.4 32H194.6c-20.7 0-39 13.2-45.5 32.8zM256 192a96 96 0 1 1 0 192 96 96 0 1 1 0-192z" />
    </svg>
  ),
  Gallery: () => (
    <svg viewBox="0 0 512 512" width="32" height="32" fill="currentColor">
      <path d="M0 96C0 60.7 28.7 32 64 32H448c35.3 0 64 28.7 64 64V416c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V96zM323.8 202.5c-4.5-6.6-11.9-10.5-19.8-10.5s-15.4 3.9-19.8 10.5l-87 127.6L170.7 297c-4.6-5.7-11.5-9-18.7-9s-14.2 3.3-18.7 9l-64 80c-5.8 7.2-6.9 17.1-2.9 25.4s12.4 13.6 21.6 13.6h96 32H424c8.9 0 17.1-4.9 21.2-12.8s3.6-17.4-1.4-24.7l-120-176zM112 192a48 48 0 1 0 0-96 48 48 0 1 0 0 96z" />
    </svg>
  ),
  Pen: () => (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  ),
};

function aggregateIngredients(ingredients) {
  const map = new Map();
  for (const ing of ingredients || []) {
    const key = (ing.name || "").trim().toLowerCase();
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, { name: ing.name, weight: 0, calories: 0, cal: 0, protein: 0, p: 0, fat: 0, f: 0, carbs: 0, c: 0 });
    }
    const entry = map.get(key);
    entry.weight += Number(ing.weight) || 0;
    const cal = Number(ing.calories || ing.cal) || 0;
    entry.calories += cal;
    entry.cal += cal;
    const p = Number(ing.protein || ing.p) || 0;
    entry.protein += p;
    entry.p += p;
    const f = Number(ing.fat || ing.f) || 0;
    entry.fat += f;
    entry.f += f;
    const c = Number(ing.carbs || ing.c) || 0;
    entry.carbs += c;
    entry.c += c;
  }
  return [...map.values()];
}

export default function MainPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [todayMeals, setTodayMeals] = useState([]);
  const [inputWeight, setInputWeight] = useState("");
  const [inputName, setInputName] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [showDailyLimit, setShowDailyLimit] = useState(false);
  const [mealImageSrc, setMealImageSrc] = useState(null);
  const [mealImagesCache, setMealImagesCache] = useState({});
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [editingIngIndex, setEditingIngIndex] = useState(null);
  const [editingIngName, setEditingIngName] = useState("");
  const [editingIngKcal, setEditingIngKcal] = useState("");
  const [editingIngLoading, setEditingIngLoading] = useState(false);
  const [suggestionsAbove, setSuggestionsAbove] = useState(false);
  const [allIngredientNames, setAllIngredientNames] = useState([]);
  const [confirmDeleteIngIndex, setConfirmDeleteIngIndex] = useState(null);
  const ingInputRef = React.useRef(null);

  const { canTakePhoto, incrementQuota, userLimit } = useDailyQuota();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const analyzeAbortRef = React.useRef(null);

  const [dailyNorm, setDailyNorm] = useState({
    calories: 2000,
    proteins: 150,
    fats: 80,
    carbs: 300,
  });
  const [budgetProfile, setBudgetProfile] = useState(null);
  const steps = useStepBudget(budgetProfile);
  const health = useHealthImport();
  const accrued = useAccrualBudget(budgetProfile, steps.reading, health.timezone===Intl.DateTimeFormat().resolvedOptions().timeZone ? health.days.find(day=>day.day===localDay()) : null);
  const calorieGoal = accrued.enabled ? accrued.accrued : steps.budget.goal || dailyNorm.calories;
  const [dailyTotal, setDailyTotal] = useState({
    calories: 0,
    proteins: 0,
    fats: 0,
    carbs: 0,
  });

  const allMealsRef = React.useRef([]);
  const displayedDay = React.useRef('');
  const updateToday = (allMeals) => {
    const day = new Date().toDateString();
    displayedDay.current = day;
    const meals = allMeals.filter(meal => new Date(meal.date).toDateString() === day)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    setTodayMeals(meals);
    setDailyTotal(meals.reduce((total, meal) => ({
      calories: total.calories + Number(meal.calories || 0),
      proteins: total.proteins + Number(meal.protein || 0),
      fats: total.fats + Number(meal.fat || 0),
      carbs: total.carbs + Number(meal.carbs || 0),
    }), { calories: 0, proteins: 0, fats: 0, carbs: 0 }));
  };
  useEffect(() => {
    const checkDay = () => {
      if (!document.hidden && displayedDay.current !== new Date().toDateString()) updateToday(allMealsRef.current);
    };
    checkDay();
    document.addEventListener('visibilitychange', checkDay);
    window.addEventListener('focus', checkDay);
    const timer = setInterval(checkDay, 30000);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', checkDay); window.removeEventListener('focus', checkDay); };
  }, []);

  const f = (num) => Math.round(Number(num || 0) * 10) / 10;
  const swipeHandlers = useSwipeNavigation(location.pathname, showResult || showAddSheet);

  useBackHandler([
    { when: () => fullscreenImage,                  do: () => setFullscreenImage(null) },
    { when: () => confirmDeleteIngIndex !== null,   do: () => setConfirmDeleteIngIndex(null) },
    { when: () => editingIngIndex !== null,         do: () => setEditingIngIndex(null) },
    { when: () => showDeleteConfirm,                do: () => setShowDeleteConfirm(false) },
    { when: () => showDailyLimit,                   do: () => setShowDailyLimit(false) },
    { when: () => serverError,                      do: () => setServerError(false) },
    { when: () => showAddSheet,                     do: () => setShowAddSheet(false) },
    { when: () => showManualEntry,                  do: () => setShowManualEntry(false) },
    { when: () => showResult,                       do: () => setShowResult(false) },
  ]);

  const navWithDir = (to) => {
    const curr = PAGE_ORDER.indexOf(location.pathname);
    const dest = PAGE_ORDER.indexOf(to);
    navigate(to, { state: { direction: dest > curr ? "left" : "right" } });
  };

  useEffect(() => {
    const setStatusBarStyle = async () => {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
      } catch (err) {
        console.warn("StatusBar not supported", err);
      }
    };
    setStatusBarStyle();

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const accountId = await ensureAccount(user);
          if (accountId) await fetchUserData(accountId);
        } catch { setLoadFailed(true); setLoading(false); }
      } else {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const incomingMeal = location.state?.newMeal;
    if (incomingMeal) {
      setSelectedMeal({
        ...incomingMeal,
        isNew: true,
        originalData: incomingMeal,
        id: Date.now().toString(),
      });
      setInputName(incomingMeal.name || t("new_dish"));
      setInputWeight((incomingMeal.weight || "").toString());
      setShowResult(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state?.newMeal, location.pathname, navigate, t]);

  useEffect(() => () => analyzeAbortRef.current?.abort(), []);

  const fetchUserData = async (accountId) => {
    try {
      setLoadFailed(false);
      if (!accountId) accountId = await getAccountId();
      if (!accountId) return;
      const [userDoc, snapshot] = await Promise.all([
        getDoc(doc(db, 'users', accountId)),
        getDocs(collection(db, 'users', accountId, 'meals')),
      ]);
      if (userDoc.exists() && userDoc.data().dailyNorm)
        setDailyNorm(userDoc.data().dailyNorm);
      if (userDoc.exists()) setBudgetProfile(userDoc.data());
      const allMeals = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
      allMealsRef.current = allMeals;
      updateToday(allMeals);
      const ingSet = new Set();
      allMeals.forEach((m) => (m.ingredients || []).forEach((ing) => { if (ing.name) ingSet.add(ing.name); }));
      setAllIngredientNames([...ingSet].sort((a, b) => a.localeCompare(b)));
      setHasLoaded(true);
    } catch (e) {
      setLoadFailed(true);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useHourlyBudget(fetchUserData);

  const processImage = async (rawBase64, sourceMode = "photo") => {
    if (analyzeAbortRef.current) return;
    setAnalyzing(true);
    setShowResult(false);
    const controller = new AbortController();
    analyzeAbortRef.current = controller;
    try {
      const compressed = await compressImage(rawBase64, controller.signal);

      const data = await apiFetch("/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: compressed,
          language: gramixStorage.get(STORAGE_KEYS.LANG) || "ru",
        }),
        signal: controller.signal,
      });
      if (!Array.isArray(data.ingredients) || !data.ingredients.length) {
        reportIncident('analysis_invalid_result', null, { code: 'invalid_response', endpoint: '/analyze' });
        throw new Error('invalid_response');
      }
      void incrementQuota();

      const rawIngredients = (data.ingredients || []).map((ing) => ({
          name: ing.name,
          weight: Number(ing.weight_g || ing.weight || ing.grams || 0),
          calories: Number(ing.calories || ing.cal || 0),
          protein: Number(ing.protein || ing.p || 0),
          fat: Number(ing.fat || ing.f || 0),
          carbs: Number(ing.carbs || ing.c || 0),
        }));
        const normalizedData = {
          ...data,
          name: data.dish_name || data.name || t("new_dish"),
          weight: Number(data.total_weight_g || data.weight || 0),
          calories: Number(data.calories || 0),
          protein: Number(data.protein || 0),
          fat: Number(data.fat || 0),
          carbs: Number(data.carbs || 0),
          ingredients: aggregateIngredients(rawIngredients),
        };
        setSelectedMeal({
          ...normalizedData,
          image: compressed,
          id: Date.now().toString(),
          originalData: normalizedData,
          isNew: true,
        });
        setInputWeight(normalizedData.weight.toString());
        setInputName(normalizedData.name);
        setShowResult(true);
        learnIngredients(
          normalizedData.ingredients,
          gramixStorage.get(STORAGE_KEYS.LANG) || "ru",
        );
      trackAnalyzeRequest(sourceMode);
    } catch (e) {
      if (e?.message === 'image_decode_failed') reportIncident('image_decode_failed', e, { code: 'image_decode_failed', imageStage: e.stage });
      if (e?.name !== "AbortError") setServerError(true);
    } finally {
      analyzeAbortRef.current = null;
      setAnalyzing(false);
    }
  };

  const cancelAnalysis = () => {
    if (analyzeAbortRef.current) analyzeAbortRef.current.abort();
    setAnalyzing(false);
  };

  const processText = async (textInput) => {
    if (analyzeAbortRef.current) return;
    if (!canTakePhoto()) { setShowDailyLimit(true); return; }
    const controller = new AbortController();
    analyzeAbortRef.current = controller;
    setShowManualEntry(false);
    setAnalyzing(true);
    setShowResult(false);
    try {
      const data = await apiFetch("/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: textInput,
          language: gramixStorage.get(STORAGE_KEYS.LANG) || "ru",
        }),
        signal: controller.signal,
      });
      if (
          !data.ingredients ||
          data.ingredients.length === 0 ||
          data.name?.toLowerCase().includes("unknown") ||
          data.name?.toLowerCase().includes("неизвест")
        ) {
          reportIncident('analysis_invalid_result', null, { code: 'invalid_response', endpoint: '/analyze' });
          throw new Error("Unrecognized dish");
        }
        void incrementQuota();
        const aggregated = aggregateIngredients(data.ingredients);
        const mealData = {
          ...data,
          ingredients: aggregated,
          weight: Number(data.weight || 0),
          calories: Number(data.calories || 0),
          protein: Number(data.protein || 0),
          fat: Number(data.fat || 0),
          carbs: Number(data.carbs || 0),
        };
        setSelectedMeal({
          ...mealData,
          image: null,
          id: Date.now().toString(),
          originalData: mealData,
          isNew: true,
        });
        setInputWeight(String(mealData.weight));
        setInputName(data.name || t("new_dish"));
        setShowResult(true);
        learnIngredients(
          aggregated,
          gramixStorage.get(STORAGE_KEYS.LANG) || "ru",
        );
      trackAnalyzeRequest("manual");
    } catch (error) {
      if (error.name !== 'AbortError') setServerError(true);
    } finally {
      analyzeAbortRef.current = null;
      setAnalyzing(false);
    }
  };

  const updateMealWeight = (newWeight) => {
    const baseData = selectedMeal.originalData || selectedMeal;
    if (!baseData || !baseData.weight) return;
    const targetWeight = parseFloat(newWeight);
    if (isNaN(targetWeight) || targetWeight <= 0) return;
    if (Math.abs(targetWeight - (selectedMeal.weight || 0)) < 0.01) return;
    // Pure local scaling — no AI call, so it does not consume the edit quota.
    const factor = targetWeight / baseData.weight;
    setSelectedMeal((prev) => ({
      ...prev,
      weight: targetWeight,
      calories: baseData.calories * factor,
      protein: baseData.protein * factor,
      fat: baseData.fat * factor,
      carbs: baseData.carbs * factor,
      ingredients: (baseData.ingredients || []).map((ing) => ({
        ...ing,
        weight: ing.weight * factor,
        cal: (ing.calories || ing.cal || 0) * factor,
        p: (ing.protein || ing.p || 0) * factor,
        f: (ing.fat || ing.f || 0) * factor,
        c: (ing.carbs || ing.c || 0) * factor,
        calories: (ing.calories || ing.cal || 0) * factor,
        protein: (ing.protein || ing.p || 0) * factor,
        fat: (ing.fat || ing.f || 0) * factor,
        carbs: (ing.carbs || ing.c || 0) * factor,
      })),
    }));
  };

  const removeIngredient = (indexToRemove) => {
    if (!selectedMeal || !selectedMeal.ingredients) return;
    setConfirmDeleteIngIndex(indexToRemove);
  };

  const doRemoveIngredient = (indexToRemove) => {
    trackIngredientEdit();
    const removedIng = selectedMeal.ingredients[indexToRemove];
    const updatedIngredients = selectedMeal.ingredients.filter(
      (_, idx) => idx !== indexToRemove,
    );
    const ingCal = removedIng.calories || removedIng.cal || 0;
    const ingPro = removedIng.protein || removedIng.p || 0;
    const ingFat = removedIng.fat || removedIng.f || 0;
    const ingCarb = removedIng.carbs || removedIng.c || 0;
    const newWeight = Math.max(0, selectedMeal.weight - (removedIng.weight || 0));
    const newCals = Math.max(0, selectedMeal.calories - ingCal);
    const newPro = Math.max(0, selectedMeal.protein - ingPro);
    const newFat = Math.max(0, selectedMeal.fat - ingFat);
    const newCarbs = Math.max(0, selectedMeal.carbs - ingCarb);
    setSelectedMeal({
      ...selectedMeal,
      weight: newWeight, calories: newCals, protein: newPro, fat: newFat, carbs: newCarbs,
      ingredients: updatedIngredients,
      originalData: { ...selectedMeal.originalData, weight: newWeight, calories: newCals, protein: newPro, fat: newFat, carbs: newCarbs, ingredients: updatedIngredients },
    });
    setInputWeight(f(newWeight).toString());
    setConfirmDeleteIngIndex(null);
  };

  const openIngredientEdit = (index) => {
    const ing = selectedMeal.ingredients[index];
    setEditingIngIndex(index);
    setEditingIngName(ing.name);
    setEditingIngKcal(String(f(ing.weight || 0)));
    setSuggestionsAbove(false);
  };

  const closeIngredientEdit = () => {
    const ing = selectedMeal.ingredients[editingIngIndex];
    if (!ing.name && !editingIngName.trim()) {
      const updated = selectedMeal.ingredients.filter((_, i) => i !== editingIngIndex);
      setSelectedMeal((prev) => ({
        ...prev,
        ingredients: updated,
        originalData: { ...prev.originalData, ingredients: updated },
      }));
    }
    setEditingIngIndex(null);
  };

  const addNewIngredient = () => {
    const newIng = { name: '', weight: 0, calories: 0, cal: 0, protein: 0, p: 0, fat: 0, f: 0, carbs: 0, c: 0 };
    const updated = [...(selectedMeal.ingredients || []), newIng];
    setSelectedMeal((prev) => ({
      ...prev,
      ingredients: updated,
      originalData: { ...prev.originalData, ingredients: updated },
    }));
    setEditingIngIndex(updated.length - 1);
    setEditingIngName('');
    setEditingIngKcal('0');
    setSuggestionsAbove(false);
  };

  const confirmIngredientRename = async () => {
    const ing = selectedMeal.ingredients[editingIngIndex];
    const editedWeight = parseFloat(editingIngKcal) || 0;
    const oldName = (ing.name || "").trim();
    const newName = editingIngName.trim();
    const nameChanged = oldName.toLowerCase() !== newName.toLowerCase();

    // Only grams changed (or nothing changed) → scale macros locally, no AI call, no edit quota.
    if (!nameChanged) {
      const oldWeight = Number(ing.weight) || 0;
      const ratio = oldWeight > 0 ? editedWeight / oldWeight : 0;
      const oldCal = ing.calories || ing.cal || 0;
      const oldPro = ing.protein || ing.p || 0;
      const oldFat = ing.fat || ing.f || 0;
      const oldCarbs = ing.carbs || ing.c || 0;
      const updatedIngredients = [...selectedMeal.ingredients];
      updatedIngredients[editingIngIndex] = {
        ...ing,
        name: newName,
        weight: editedWeight,
        calories: oldCal * ratio,
        cal: oldCal * ratio,
        protein: oldPro * ratio,
        p: oldPro * ratio,
        fat: oldFat * ratio,
        f: oldFat * ratio,
        carbs: oldCarbs * ratio,
        c: oldCarbs * ratio,
      };
      const newCals = updatedIngredients.reduce((s, i) => s + (i.calories || i.cal || 0), 0);
      const newPro = updatedIngredients.reduce((s, i) => s + (i.protein || i.p || 0), 0);
      const newFat = updatedIngredients.reduce((s, i) => s + (i.fat || i.f || 0), 0);
      const newCarbs = updatedIngredients.reduce((s, i) => s + (i.carbs || i.c || 0), 0);
      const newWeight = updatedIngredients.reduce((s, i) => s + (i.weight || 0), 0);
      setSelectedMeal((prev) => ({
        ...prev,
        calories: newCals,
        protein: newPro,
        fat: newFat,
        carbs: newCarbs,
        weight: newWeight,
        ingredients: updatedIngredients,
        originalData: {
          ...prev.originalData,
          calories: newCals,
          protein: newPro,
          fat: newFat,
          carbs: newCarbs,
          weight: newWeight,
          ingredients: updatedIngredients,
        },
      }));
      setInputWeight(f(newWeight).toString());
      setEditingIngIndex(null);
      return;
    }

    const lang = gramixStorage.get(STORAGE_KEYS.LANG) || "ru";
    setEditingIngLoading(true);
    trackIngredientEdit();
    try {
      const data = await apiFetch("/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `${editingIngName}, ${editedWeight}г`, language: lang }),
      });
      const updatedIngredients = [...selectedMeal.ingredients];
        updatedIngredients[editingIngIndex] = {
          ...ing,
          name: editingIngName,
          weight: editedWeight,
          calories: Number(data.calories || 0),
          cal: Number(data.calories || 0),
          protein: Number(data.protein || 0),
          p: Number(data.protein || 0),
          fat: Number(data.fat || 0),
          f: Number(data.fat || 0),
          carbs: Number(data.carbs || 0),
          c: Number(data.carbs || 0),
        };
        learnIngredient(
          {
            name: editingIngName,
            weight: editedWeight,
            calories: Number(data.calories || 0),
            protein: Number(data.protein || 0),
            fat: Number(data.fat || 0),
            carbs: Number(data.carbs || 0),
          },
          lang,
        );
        const newCals = updatedIngredients.reduce((s, i) => s + (i.calories || i.cal || 0), 0);
        const newPro = updatedIngredients.reduce((s, i) => s + (i.protein || i.p || 0), 0);
        const newFat = updatedIngredients.reduce((s, i) => s + (i.fat || i.f || 0), 0);
        const newCarbs = updatedIngredients.reduce((s, i) => s + (i.carbs || i.c || 0), 0);
        const newWeight = updatedIngredients.reduce((s, i) => s + (i.weight || 0), 0);
        setSelectedMeal((prev) => ({
          ...prev,
          calories: newCals,
          protein: newPro,
          fat: newFat,
          carbs: newCarbs,
          weight: newWeight,
          ingredients: updatedIngredients,
          originalData: {
            ...prev.originalData,
            calories: newCals,
            protein: newPro,
            fat: newFat,
            carbs: newCarbs,
            weight: newWeight,
            ingredients: updatedIngredients,
          },
        }));
        setInputWeight(f(newWeight).toString());
      setEditingIngIndex(null);
    } catch (e) {
      console.error("Ingredient rename error:", e);
    } finally {
      setEditingIngLoading(false);
    }
  };

  const saveMeal = async () => {
    if (!selectedMeal) return;

    const aggregatedIngredients = (() => {
      const map = new Map();
      for (const ing of selectedMeal.ingredients || []) {
        const key = (ing.name || "").trim().toLowerCase();
        if (!key) continue;
        if (!map.has(key)) {
          map.set(key, { name: ing.name, weight: 0, cal: 0, p: 0, f: 0, c: 0 });
        }
        const entry = map.get(key);
        entry.weight += Number(ing.weight) || 0;
        entry.cal += Number(ing.calories || ing.cal) || 0;
        entry.p += Number(ing.protein || ing.p) || 0;
        entry.f += Number(ing.fat || ing.f) || 0;
        entry.c += Number(ing.carbs || ing.c) || 0;
      }
      return [...map.values()];
    })();

    try {
      const user = auth.currentUser;
      const accountId = await getAccountId();
      const mealId =
        selectedMeal.id ||
        doc(collection(db, "users", accountId, "meals")).id;

      const mealData = {
        id: mealId,
        name: inputName,
        calories: f(selectedMeal.calories),
        protein: f(selectedMeal.protein),
        fat: f(selectedMeal.fat),
        carbs: f(selectedMeal.carbs),
        weight: f(selectedMeal.weight),
        date: selectedMeal.date || new Date().toISOString(),
        ingredients: aggregatedIngredients.map((ing) => ({
          name: ing.name,
          weight: f(ing.weight),
          cal: f(ing.cal),
          p: f(ing.p),
          f: f(ing.f),
          c: f(ing.c),
        })),
      };

      const batch = writeBatch(db);
      batch.set(doc(db, "users", accountId, "meals", mealId), mealData);

      const imageToSave = selectedMeal.image || mealImageSrc;
      if (imageToSave) {
        batch.set(doc(db, "meal_images", mealId), {
          userId: user.uid,
          image: imageToSave,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
      }

      await batch.commit();
      if (selectedMeal.fromDraft) clearDraft(selectedMeal.draftSnapshot);
      if (selectedMeal.isNew) trackMealAdded();
      // Cache image locally so the meal card renders it immediately after refresh
      if (imageToSave) {
        setMealImagesCache((prev) => ({ ...prev, [mealId]: imageToSave }));
      }
      // Fire-and-forget: enrich saved meal with category/ingredient keys.
      const lang = gramixStorage.get(STORAGE_KEYS.LANG) || "ru";
      categorizeAndPatchMeal(accountId, mealId, mealData.ingredients, lang).catch(
        (e) => console.warn("categorizeAndPatchMeal failed", e)
      );
      await fetchUserData(accountId);
      setShowResult(false);
    } catch {
      alert(t("save_error"));
    }
  };

  const deleteMeal = async () => {
    if (!selectedMeal || selectedMeal.isNew) return;
    setShowDeleteConfirm(true);
  };

  const doDeleteMeal = async () => {
    setShowDeleteConfirm(false);
    try {
      const accountId = await getAccountId();
      await deleteDoc(doc(db, "users", accountId, "meals", selectedMeal.id));
      trackMealDeleted();
      await fetchUserData(accountId);
      setShowResult(false);
    } catch {
      alert(t("delete_error"));
    }
  };

  const resumePhoto = useEffectEvent(source => { void processImage(source, 'photo'); });
  useEffect(() => subscribeRestoredPhoto(source => resumePhoto(source)), []);

  const handlePhotoUpload = async (capture) => {
    if (!canTakePhoto()) {
      setShowDailyLimit(true);
      return;
    }
    if (Capacitor.isNativePlatform()) {
      try {
        const source = await captureNativePhoto(capture);
        await processImage(source, capture ? 'photo' : 'gallery');
      } catch (error) {
        if (!/cancel/i.test(String(error.message)) && !['OS-PLUG-CAMR-0006', 'OS-PLUG-CAMR-0020'].includes(error.code)) {
          reportIncident('image_decode_failed', error, { code: 'image_decode_failed', imageStage: 'native_picker' });
          setServerError(true);
        }
      }
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (capture) input.capture = "environment";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const mode = capture ? "photo" : "gallery";
        void processImage(file, mode);
      }
    };
    input.click();
  };

  if (loading)
    return (
      <div className="page loading-screen">
        <h2>Gramix...</h2>
      </div>
    );

  if (loadFailed && !hasLoaded) return <LoadError onRetry={() => { setLoading(true); void fetchUserData(); }} />;

  return (
    <div className="main-page" {...(showResult ? {} : swipeHandlers)}>
      <div className="main-phone">
        {loadFailed && <LoadError inline onRetry={() => { void fetchUserData(); }} />}
        <header className="main-header">
          <div className="main-header-text">
            <span className="red-part"><span className="mechanical-g">G</span>ramix</span>
          </div>
          <div
            className="main-profile-btn"
            onClick={() => navigate("/profile")}
          >
            <Icons.Profile />
          </div>
        </header>

        <main className="main-content">
          {(() => {
            const today = new Date();
            const lang = (typeof navigator !== "undefined" && navigator.language) || "ru";
            const dateLabel = today.toLocaleDateString(lang, {
              weekday: "short",
              day: "numeric",
              month: "short",
            });
            const macros = [
              { key: "p", label: t("protein"), val: dailyTotal.proteins, goal: dailyNorm.proteins, color: "var(--brand-lilac)" },
              { key: "f", label: t("fat"),     val: dailyTotal.fats,     goal: dailyNorm.fats,     color: "var(--brand-coral)" },
              { key: "c", label: t("carbs"),   val: dailyTotal.carbs,    goal: dailyNorm.carbs,    color: "var(--brand-peach)" },
            ];
            return (
              <>
                <div className="home-date-row">
                  <div className="home-date-today">{t("today")}</div>
                  <div className="home-date-main">{dateLabel}</div>
                </div>

                  <CalorieOverview personalAverage={averageExpenditure(budgetProfile,health.timezone===Intl.DateTimeFormat().resolvedOptions().timeZone?health.days:[])} averages={[diaryAverage(allMealsRef.current), diaryAverage(allMealsRef.current, periodWindow('month'))]}
                    autoBudget={accrued.enabled ? accrued : null} goal={calorieGoal} eaten={dailyTotal.calories} base={accrued.enabled ? accrued.resting : dailyNorm.calories} extra={accrued.enabled ? accrued.movement : steps.budget.extra}>

                  <div className="home-mini-rings">
                    {macros.map((m) => {
                      const mOver = m.val > m.goal;
                      return (
                        <div key={m.key} className="home-mini-ring">
                          <RingProgress
                            size={72}
                            stroke={5}
                            value={m.val}
                            max={m.goal}
                            color={m.color}
                            pulse
                          >
                            <div className={`mini-ring-val${mOver ? " is-over" : ""}`}>
                              {Math.round(m.val)}
                            </div>
                            <div className="mini-ring-goal">
                              / {Math.round(m.goal)}{t("grams_unit")}
                            </div>
                          </RingProgress>
                          <div className="home-mini-label">{m.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </CalorieOverview>
              </>
            );
          })()}

          {todayMeals.length > 0 && (
            <h3 className="meals-section-title">{t("meals_section")}</h3>
          )}

          <section className="meals-list">
            {todayMeals.map((meal) => {
              const mealDate = new Date(meal.date || Date.now());
              const timeLabel = mealDate.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
              <div
                key={meal.id}
                className="meal-card"
                onClick={async () => {
                  setSelectedMeal({
                    ...meal,
                    isNew: false,
                    originalData: meal,
                  });
                  setInputName(meal.name);
                  setInputWeight(meal.weight);
                  // Use cached image for instant display; undefined means not yet fetched
                  const cachedImg = meal.id in mealImagesCache ? mealImagesCache[meal.id] : undefined;
                  setMealImageSrc(cachedImg ?? null);
                  setShowResult(true);
                  // Only fetch from Firestore if not already in cache
                  if (!(meal.id in mealImagesCache)) {
                    try {
                      const imgDoc = await getDoc(doc(db, "meal_images", meal.id));
                      const img = imgDoc.exists() ? imgDoc.data().image : null;
                      setMealImageSrc(img);
                      setMealImagesCache((prev) => ({ ...prev, [meal.id]: img }));
                    } catch {
                      setMealImageSrc(null);
                    }
                  }
                }}
              >
                <MealThumbnail
                  mealId={meal.id}
                  fallback={errorPlateImg}
                  className="meal-card-img"
                />
                <div className="meal-card-info">
                  <div className="meal-card-row">
                    <h3>{getDishName(meal.name, i18n.language)}</h3>
                    <span className="meal-card-time">{timeLabel}</span>
                  </div>
                  <div className="meal-card-stats">
                    <span className="meal-card-kcal">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2c1 4 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 1-5-3 2-5 5-5 8a8 8 0 1 0 16 0c0-6-5-8-8-12z" />
                      </svg>
                      {Math.round(meal.calories || 0)} {t("kcal")}
                    </span>
                    <span className="meal-card-dot" />
                    <span className="meal-card-bju">
                      <span className="meal-bju-item">
                        <span className="meal-bju-dot" style={{ background: 'var(--brand-lilac)' }} />
                        {t("protein_short")} {Math.round(meal.protein || meal.proteins || 0)}
                      </span>
                      <span className="meal-bju-item">
                        <span className="meal-bju-dot" style={{ background: 'var(--brand-coral)' }} />
                        {t("fat_short")} {Math.round(meal.fat || meal.fats || 0)}
                      </span>
                      <span className="meal-bju-item">
                        <span className="meal-bju-dot" style={{ background: 'var(--brand-peach)' }} />
                        {t("carbs_short")} {Math.round(meal.carbs || 0)}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              );
            })}
          </section>
        </main>

        <button
          className="home-fab"
          onClick={() => setShowAddSheet(true)}
          aria-label={t("snap_food")}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 4h-5L7 6.5H4a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 4 19.5h16a1.5 1.5 0 0 0 1.5-1.5V8A1.5 1.5 0 0 0 20 6.5h-3L14.5 4Z" />
            <circle cx="12" cy="13" r="3.6" />
          </svg>
          <span className="home-fab-badge">+</span>
        </button>

        <nav className="home-tabbar">
          <div className="home-tabbar-inner">
            <button
              className={`home-tab${location.pathname === "/main" ? " is-active" : ""}`}
              onClick={() => navWithDir("/main")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2v-9z" />
              </svg>
              {location.pathname === "/main" && <span>{t("nav_home")}</span>}
            </button>
            <button
              className={`home-tab${location.pathname === "/stats" ? " is-active" : ""}`}
              onClick={() => navWithDir("/stats")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 20V10M12 20V4M19 20v-7" />
              </svg>
              {location.pathname === "/stats" && <span>{t("nav_stats")}</span>}
            </button>
          </div>
        </nav>

        {showAddSheet && (
          <AddMealSheet title={t("add_meal")} onClose={() => setShowAddSheet(false)}>

              <button
                className="add-sheet-row"
                onClick={() => {
                  setShowAddSheet(false);
                  if (!canTakePhoto()) { setShowDailyLimit(true); return; }
                  navigate("/manual-entry");
                }}
              >
                <span className="add-sheet-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 4l6 6-11 11H3v-6L14 4z" />
                  </svg>
                </span>
                <div className="add-sheet-text">
                  <div className="add-sheet-row-title">{t("add_manually")}</div>
                  <div className="add-sheet-row-sub">{t("manual_entry_sub")}</div>
                </div>
              </button>

              <button
                className="add-sheet-row"
                onClick={() => {
                  setShowAddSheet(false);
                  if (!canTakePhoto()) { setShowDailyLimit(true); return; }
                  handlePhotoUpload(false);
                }}
              >
                <span className="add-sheet-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="16" rx="3" />
                    <circle cx="9" cy="10" r="1.6" />
                    <path d="M21 15l-5-5-9 10" />
                  </svg>
                </span>
                <div className="add-sheet-text">
                  <div className="add-sheet-row-title">{t("from_gallery")}</div>
                  <div className="add-sheet-row-sub">{t("from_gallery_sub")}</div>
                </div>
              </button>

              <button
                className="add-sheet-row"
                onClick={() => {
                  setShowAddSheet(false);
                  if (!canTakePhoto()) { setShowDailyLimit(true); return; }
                  handlePhotoUpload(true);
                }}
              >
                <span className="add-sheet-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 4h-5L7 6.5H4a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 4 19.5h16a1.5 1.5 0 0 0 1.5-1.5V8A1.5 1.5 0 0 0 20 6.5h-3L14.5 4Z" />
                    <circle cx="12" cy="13" r="3.6" />
                  </svg>
                </span>
                <div className="add-sheet-text">
                  <div className="add-sheet-row-title">{t("take_photo")}</div>
                  <div className="add-sheet-row-sub">{t("take_photo_sub")}</div>
                </div>
              </button>

              <button className="add-sheet-cancel" onClick={() => setShowAddSheet(false)}>
                {t("close")}
              </button>
          </AddMealSheet>
        )}

        {/* ── Analyzing spinner ── */}
        {analyzing && (
          <div className="analyzing-overlay analyzing-overlay--fullscreen">
            <div className="loading-spinner"></div>
            <h2 className="analyzing-text">{t("analyzing")}</h2>
            <button className="analyzing-cancel-btn" onClick={cancelAnalysis}>
              {t("close")}
            </button>
          </div>
        )}

        {/* ── Unrecognized dish error popup (bottom sheet) ── */}
        <BottomSheetPopup
          open={serverError}
          onClose={() => setServerError(false)}
          variant="error"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          }
          title={t("popup_recognize_title")}
          description={t("popup_recognize_desc")}
          primaryLabel={t("popup_retry")}
          onPrimary={() => setServerError(false)}
          secondaryLabel={t("ok")}
        />

        {/* ── Daily photo limit popup ── */}
        <BottomSheetPopup
          open={showDailyLimit}
          onClose={() => setShowDailyLimit(false)}
          variant="warning"
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          }
          title={t("popup_photo_limit_title")}
          description={t("popup_photo_limit_desc", { limit: userLimit })}
          primaryLabel={t("add_manually")}
          onPrimary={() => {
            setShowDailyLimit(false);
            navigate("/manual-entry");
          }}
          secondaryLabel={t("ok")}
        />

        {/* ── Manual text entry modal ── */}
        {showManualEntry && (
          <div
            className="analyzing-overlay"
            onClick={() => setShowManualEntry(false)}
          >
            <div
              className="manual-entry-card"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="manual-entry-label">{t("manual_entry_hint")}</p>
              <textarea
                className="manual-entry-textarea"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                rows={5}
                autoFocus
              />
              <div className="manual-entry-actions">
                <button
                  className="manual-cancel-btn"
                  onClick={() => setShowManualEntry(false)}
                >
                  {t("close")}
                </button>
                <button
                  className="manual-submit-btn"
                  onClick={() => processText(manualInput)}
                  disabled={!manualInput.trim()}
                >
                  {t("analyze")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Meal detail overlay ── */}
        {showResult && selectedMeal && (
          <div
            className="result-overlay-full"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="meal-detail-page">
              {/* Hero photo with back button */}
              <div className="md-hero">
                {(selectedMeal.isNew ? selectedMeal.image : mealImageSrc) ? (
                  <img
                    src={selectedMeal.isNew ? selectedMeal.image : mealImageSrc}
                    alt=""
                    className="md-hero-img"
                    onClick={() => setFullscreenImage(selectedMeal.isNew ? selectedMeal.image : mealImageSrc)}
                  />
                ) : (
                  <div className="md-hero-placeholder">
                    <div className="md-hero-placeholder-inner">
                      <img src={errorPlateImg} alt="" className="me-photo-img" />
                    </div>
                  </div>
                )}
                <div className="md-hero-grad" />
                <button className="md-back-btn" onClick={() => setShowResult(false)} aria-label="back">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              </div>

              <div className="md-body">
                {/* Title */}
                <div className="md-title-block">
                  <textarea
                    className="md-title-input"
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Stat strip — calories left, weight right + 3 BJU pills */}
                <div className="md-stat-strip">
                  <div className="md-stat-row">
                    <div className="md-stat-cell">
                      <div className="md-stat-label">{t("calories")}</div>
                      <div className="md-stat-cals">
                        {Math.round(selectedMeal.calories || 0)}
                        <span className="md-stat-unit"> {t("kcal")}</span>
                      </div>
                    </div>
                    <div className="md-stat-cell md-stat-right">
                      <div className="md-stat-label">{t("weight")}</div>
                      <div className="md-stat-weight">
                        {Math.round(selectedMeal.weight || 0)}
                        <span className="md-stat-unit"> {t("grams_unit")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="md-bju-pills">
                    {[
                      { k: "p", label: t("protein"), v: selectedMeal.protein, color: "var(--brand-lilac)" },
                      { k: "f", label: t("fat"),     v: selectedMeal.fat,     color: "var(--brand-coral)" },
                      { k: "c", label: t("carbs"),   v: selectedMeal.carbs,   color: "var(--brand-peach)" },
                    ].map((m) => (
                      <div key={m.k} className="md-bju-pill">
                        <div className="md-bju-pill-head">
                          <span className="md-bju-dot" style={{ background: m.color }} />
                          <span className="md-bju-name">{m.label}</span>
                        </div>
                        <div className="md-bju-val">
                          {Math.round(m.v || 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Compact weight editor */}
                <div className="md-weight-editor">
                  <span className="md-weight-label">{t("weight")}</span>
                  <div className="md-weight-input">
                    <input
                      type="number"
                      value={inputWeight}
                      onChange={(e) => setInputWeight(e.target.value)}
                    />
                    <span className="md-weight-input-unit">{t("grams_unit")}</span>
                  </div>
                  <button className="md-recalc-btn" onClick={() => updateMealWeight(inputWeight)}>
                    {t("recalculate")}
                  </button>
                </div>

                {/* Ingredients header + list */}
                <div className="md-ing-header">
                  <div className="md-ing-title">{t("ingredients")}</div>
                  <button className="md-ing-add" onClick={addNewIngredient}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    {t("add_ingredient")}
                  </button>
                </div>

                <div className="md-ing-list">
                  {selectedMeal.ingredients?.map((ing, i) => (
                    <div key={i} className="md-ing-card">
                      <div className="md-ing-info">
                        <div className="md-ing-name-row">
                          <span className="md-ing-name">{getIngredientName(ing, i18n.language)}</span>
                          <span className="md-ing-w">{Math.round(ing.weight || 0)} {t("grams_unit")}</span>
                        </div>
                        <div className="md-ing-meta">
                          <span className="md-ing-kcal">
                            {Math.round(ing.calories || ing.cal || 0)} {t("kcal")}
                          </span>
                        </div>
                        <div className="md-ing-tags">
                          {[
                            { k: "p", v: ing.protein || ing.p || 0, color: "var(--brand-lilac)" },
                            { k: "f", v: ing.fat || ing.f || 0,     color: "var(--brand-coral)" },
                            { k: "c", v: ing.carbs || ing.c || 0,   color: "var(--brand-peach)" },
                          ].map((x) => (
                            <span key={x.k} className="md-ing-tag">
                              <span className="md-ing-tag-dot" style={{ background: x.color }} />
                              {x.k === "p" ? t("protein_short") : x.k === "f" ? t("fat_short") : t("carbs_short")} {Math.round(x.v)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="md-ing-actions">
                        <button
                          className="md-ing-iconbtn"
                          onClick={() => openIngredientEdit(i)}
                          aria-label="edit"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 4l6 6-11 11H3v-6L14 4z" />
                          </svg>
                        </button>
                        <button
                          className="md-ing-iconbtn md-ing-delete-btn"
                          onClick={() => removeIngredient(i)}
                          aria-label="delete"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

              </div>

              {/* Save dock */}
              <div className="md-save-dock">
                {!selectedMeal.isNew && (
                  <button className="md-delete-btn" onClick={deleteMeal}>
                    {t("delete")}
                  </button>
                )}
                <button className="md-save-btn" onClick={saveMeal}>
                  {t("save")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Ingredient edit popup (fixed, above everything) ── */}
        {editingIngIndex !== null && (
          <div
            className="analyzing-overlay"
            style={{ zIndex: 4000, paddingBottom: '50vh' }}
            onClick={() => !editingIngLoading && closeIngredientEdit()}
          >
            <div className="ing-edit-modal" onClick={(e) => e.stopPropagation()}>
              <h4>{t("edit_ingredient")}</h4>
              <div className="me-ingredient-row">
                <div className="ing-search-wrapper me-ing-name">
                  <input
                    ref={ingInputRef}
                    className="me-text-input"
                    value={editingIngName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingIngName(val);
                      if (ingInputRef.current) {
                        const rect = ingInputRef.current.getBoundingClientRect();
                        setSuggestionsAbove(rect.bottom + 165 > window.innerHeight);
                      }
                    }}
                    autoFocus
                    placeholder={t('ingredient_name_label')}
                  />
                  {(() => {
                    const sugg = editingIngName.trim().length > 0
                      ? allIngredientNames.filter((n) =>
                          n.toLowerCase().includes(editingIngName.toLowerCase()) &&
                          n.toLowerCase() !== editingIngName.toLowerCase()
                        ).slice(0, 6)
                      : [];
                    return sugg.length > 0 ? (
                      <div className={`ing-search-suggestions${suggestionsAbove ? " above" : ""}`}>
                        {sugg.map((name) => (
                          <div
                            key={name}
                            className="ing-suggestion-item"
                            onMouseDown={(e) => { e.preventDefault(); setEditingIngName(name); }}
                          >
                            {name}
                          </div>
                        ))}
                      </div>
                    ) : null;
                  })()}
                </div>
                <input
                  type="number"
                  className="me-text-input me-ing-grams"
                  value={editingIngKcal}
                  onChange={(e) => setEditingIngKcal(e.target.value)}
                  min="0"
                  placeholder={t('ingredient_grams_label')}
                />
              </div>
              {editingIngLoading ? (
                <div className="ing-edit-loading">
                  <div className="loading-spinner"></div>
                </div>
              ) : (
                <div className="manual-entry-actions">
                  <button className="manual-cancel-btn" onClick={closeIngredientEdit}>
                    {t("close")}
                  </button>
                  <button
                    className="manual-submit-btn"
                    onClick={confirmIngredientRename}
                    disabled={!editingIngName.trim()}
                  >
                    {t("apply")}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Delete ingredient confirm popup ── */}
        {confirmDeleteIngIndex !== null && (
          <div
            className="analyzing-overlay"
            style={{ zIndex: 4100 }}
            onClick={() => setConfirmDeleteIngIndex(null)}
          >
            <div className="ing-edit-modal" onClick={(e) => e.stopPropagation()}>
              <h4>{t("delete_ingredient_confirm")}</h4>
              <div className="manual-entry-actions">
                <button className="manual-cancel-btn" onClick={() => setConfirmDeleteIngIndex(null)}>
                  {t("close")}
                </button>
                <button
                  className="ing-delete-confirm-btn"
                  onClick={() => doRemoveIngredient(confirmDeleteIngIndex)}
                >
                  {t("delete")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Fullscreen photo popup ── */}
        {fullscreenImage && (
          <div className="photo-fullscreen-overlay" onClick={() => setFullscreenImage(null)}>
            <div className="photo-fullscreen-wrap" onClick={(e) => e.stopPropagation()}>
              <img
                src={fullscreenImage}
                alt=""
                className="photo-fullscreen-img"
              />
              <button
                className="photo-fullscreen-close"
                onClick={(e) => { e.stopPropagation(); setFullscreenImage(null); }}
              >×</button>
            </div>
          </div>
        )}

        <BottomSheetPopup
          open={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          variant="warning"
          title={t('delete_confirm')}
          primaryLabel={t('delete')}
          onPrimary={doDeleteMeal}
          secondaryLabel={t('cancel')}
          onSecondary={() => setShowDeleteConfirm(false)}
        />
      </div>
    </div>
  );
}
