import HubNavigation from "../components/HubNavigation";
import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useNavigate } from '../hooks/useAppNavigate';
import { useTranslation } from "react-i18next";
import { auth, db } from "./firebase-config";
import { useSwipeNavigation } from "../hooks/useSwipeNavigation";
import { useBackHandler } from "../hooks/useBackHandler";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
} from "../services/firestoreCompat";
// ВАЖЛИВО: Використовуємо наш ідеальний єдиний файл стилів!
import "./main.css";
import "./meal-detail.css";
import "./stats.css";
import errorPlateImg from "../assets/gramix-preview.webp";
import RingProgress from "../components/RingProgress";
import {
  categorizeAndPatchMeal,
  getCategoryName,
  getIngredientName,
  getDishName,
  UNCATEGORIZED,
} from "../services/categoryService";
import {
  loadNormHistory,
  ensureSeedNormHistory,
  getNormForDate,
  sumNormsForLastNDays,
} from "../services/normHistory";
import { ensureAccount, getAccountId } from "../services/account";
import { trackMealAdded, trackMealDeleted } from "../services/userMetrics";
import BottomSheetPopup from "../components/BottomSheetPopup";
import MealThumbnail from '../components/MealThumbnail';
import LoadError from '../components/LoadError';
import CalorieOverview from '../components/CalorieOverview';
import { averageExpenditure } from '../services/healthBalance';
import { useHealthImport } from '../hooks/useHealthImport';
import { useHourlyBudget } from '../hooks/useHourlyBudget';
import { useAccrualBudget } from '../hooks/useAccrualBudget';
import { useStepBudget } from '../hooks/useStepBudget';
import { periodWindow, diaryAverage, summarizeActivity } from '../services/activityStats';
import { localDay } from '../services/stepBudget';
import { gramixStorage, STORAGE_KEYS } from "../utils/storage";


const Icons = {
  Profile: () => (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  ),
};

export default function StatsPage() {
  const navigate = useNavigate();
  const location = useLocation();


  const { t, i18n } = useTranslation();
  const f = (num) => Math.round(Number(num || 0) * 10) / 10;

  const [period, setPeriod] = useState("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState([]);
  const [selectedDay, setSelectedDay] = useState({
    date: new Date(),
    day: new Date().getDate(),
  });

  const [dailyNorm, setDailyNorm] = useState({
    calories: 2000,
    proteins: 150,
    fats: 80,
    carbs: 300,
  });
  const [normHistory, setNormHistory] = useState([]);
  const [budgetProfile, setBudgetProfile] = useState(null);
  const activity = useStepBudget(budgetProfile);
  const health = useHealthImport();
  const accrued = useAccrualBudget(budgetProfile, activity.reading, health.timezone===Intl.DateTimeFormat().resolvedOptions().timeZone ? health.days.find(day=>day.day===localDay()) : null);
  const liveAccrual = accrued.enabled && period === 'day' && localDay(selectedDay.date) === localDay() ? accrued : null;
  const range = periodWindow(period, selectedDay.date);
  const activitySummary = summarizeActivity(activity.history, range);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [periodStats, setPeriodStats] = useState({
    calories: 0,
    proteins: 0,
    fats: 0,
    carbs: 0,
  });
  const [periodMeals, setPeriodMeals] = useState([]);
  const [allMeals, setAllMeals] = useState([]);
  const [mealImagesCache, setMealImagesCache] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [mealPage, setMealPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(periodMeals.length / 30));
  const currentMealPage = Math.min(mealPage, pageCount - 1);

  // Стейт для оверлею (редагування/видалення)
  const [showResult, setShowResult] = useState(false);
  const [confirmDeleteIngIndex, setConfirmDeleteIngIndex] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errorPopup, setErrorPopup] = useState(null); // string | null

  const swipeHandlers = useSwipeNavigation(location.pathname, showResult);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [inputWeight, setInputWeight] = useState("");
  const [inputName, setInputName] = useState("");
  const [mealImageSrc, setMealImageSrc] = useState(null);
  const [expandedCats, setExpandedCats] = useState({});
  // Drives ordering of categories and their ingredients (kept fixed since
  // the legacy sort-menu UI was removed).
  const sortMetric = "cal";
  const [statsTab, setStatsTab] = useState("ingredients");
  // Per-category metric selection for the K/Б/Ж/У dropdown shown inside each box.
  const [catMetrics, setCatMetrics] = useState({});
  const [openCatMetric, setOpenCatMetric] = useState(null);
  const getCatMetric = (k) => catMetrics[k] || "cal";
  const setCatMetric = (k, v) =>
    setCatMetrics((prev) => ({ ...prev, [k]: v }));
  const METRIC_INFO = {
    cal: { short: "К", long: t("kcal"),    unit: t("kcal") },
    p:   { short: t("protein_short"), long: t("protein"), unit: t("grams_unit") },
    f:   { short: t("fat_short"),     long: t("fat"),     unit: t("grams_unit") },
    c:   { short: t("carbs_short"),   long: t("carbs"),   unit: t("grams_unit") },
  };
  const metricValue = (obj, m) => {
    if (m === "p") return obj.protein || obj.p || 0;
    if (m === "f") return obj.fat || obj.f || 0;
    if (m === "c") return obj.carbs || obj.c || 0;
    return obj.calories || obj.cal || 0;
  };

  useBackHandler([
    { when: () => confirmDeleteIngIndex !== null, do: () => setConfirmDeleteIngIndex(null) },
    { when: () => showDeleteConfirm,              do: () => setShowDeleteConfirm(false) },
    { when: () => !!errorPopup,                   do: () => setErrorPopup(null) },
    { when: () => openCatMetric !== null,         do: () => setOpenCatMetric(null) },
    { when: () => showResult,                     do: () => setShowResult(false) },
  ]);

  const toggleCategory = (key) =>
    setExpandedCats((prev) => ({ ...prev, [key]: !prev[key] }));

  const SORT_FIELDS = {
    cal: { totalKey: "totalCalories", ingKey: "calories", labelKey: "calories", unit: t("kcal") },
    p:   { totalKey: "totalProtein",  ingKey: "protein",  labelKey: "protein",  unit: t("grams_unit") },
    f:   { totalKey: "totalFat",      ingKey: "fat",      labelKey: "fat",      unit: t("grams_unit") },
    c:   { totalKey: "totalCarbs",    ingKey: "carbs",    labelKey: "carbs",    unit: t("grams_unit") },
  };
  const sortField = SORT_FIELDS[sortMetric] || SORT_FIELDS.cal;

  const categoryStats = useMemo(() => {
    const buckets = new Map();
    for (const meal of periodMeals) {
      for (const ing of meal.ingredients || []) {
        const key = ing?.categoryKey || UNCATEGORIZED;
        if (!buckets.has(key)) {
          buckets.set(key, {
            categoryKey: key,
            totalCalories: 0,
            totalProtein: 0,
            totalFat: 0,
            totalCarbs: 0,
            totalWeight: 0,
            ingredients: [],
          });
        }
        const b = buckets.get(key);
        const cal = Number(ing.cal || ing.calories || 0);
        const p = Number(ing.p || ing.protein || 0);
        const fGr = Number(ing.f || ing.fat || 0);
        const c = Number(ing.c || ing.carbs || 0);
        const w = Number(ing.weight || 0);
        b.totalCalories += cal;
        b.totalProtein += p;
        b.totalFat += fGr;
        b.totalCarbs += c;
        b.totalWeight += w;
        const ingKey = (ing.ingredientKey || ing.name || "").trim().toLowerCase().replace(/[.,;!?()]/g, "").replace(/\s+/g, " ");
        const existing = b.ingredients.find(e => (e.ingredientKey || e.name || "").trim().toLowerCase().replace(/[.,;!?()]/g, "").replace(/\s+/g, " ") === ingKey);
        if (existing) {
          existing.weight += w;
          existing.calories += cal;
          existing.protein += p;
          existing.fat += fGr;
          existing.carbs += c;
        } else {
          b.ingredients.push({
            name: ing.name || "",
            ingredientKey: ing.ingredientKey || ingKey,
            weight: w,
            calories: cal,
            protein: p,
            fat: fGr,
            carbs: c,
          });
        }
      }
    }
    const totalKey = sortField.totalKey;
    const ingKey = sortField.ingKey;
    const out = [...buckets.values()];
    out.forEach((b) => b.ingredients.sort((x, y) => (y[ingKey] || 0) - (x[ingKey] || 0)));
    return out.sort((a, b) => (b[totalKey] || 0) - (a[totalKey] || 0));
  }, [periodMeals, sortMetric]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const accountId = await ensureAccount(user);
          if (accountId) await fetchUserData(accountId);
        } catch { setLoadFailed(true); setLoading(false); }
      }
      else navigate("/");
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (allMeals.length >= 0) {
      if (period === "day") generateCalendar(allMeals);
      loadStatsForPeriod(allMeals);
    }
  }, [period, currentDate, selectedDay, allMeals, dailyNorm, normHistory, calendarExpanded, activity.history]);

  const fetchUserData = async (accountId) => {
    try {
      setLoadFailed(false);
      if (!accountId) accountId = await getAccountId();
      if (!accountId) return;
      const [userDoc, snapshot] = await Promise.all([
        getDoc(doc(db, 'users', accountId)),
        getDocs(collection(db, 'users', accountId, 'meals')),
      ]);
      const userDailyNorm = userDoc.exists() ? userDoc.data().dailyNorm : null;
      if (userDailyNorm) setDailyNorm(userDailyNorm);
      if (userDoc.exists()) setBudgetProfile(userDoc.data());

      // Norm history (per-day снапшот рекомендованной нормы). Seed эффективен
      // от epoch — обеспечивает корректное разрешение нормы для прошлых дней,
      // даже если в истории появились записи позже.
      void (async () => { try {
        if (userDailyNorm) await ensureSeedNormHistory(accountId, userDailyNorm);
        const history = await loadNormHistory(accountId);
        setNormHistory(history);
      } catch (e) {
        console.warn("loadNormHistory failed", e);
      } })();
      const meals = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
      setAllMeals(meals);
      setHasLoaded(true);

      // Legacy AI category backfills belong in an explicit maintenance job,
      // not in a screen-load effect on a user's phone.
    } catch (e) {
      setLoadFailed(true);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useHourlyBudget(fetchUserData);

  const loadStatsForPeriod = (mealsToProcess) => {
    const filteredMeals = mealsToProcess.filter(meal => {
      const date = new Date(meal.date);
      return date >= range.start && date < range.until;
    });

    const total = filteredMeals.reduce(
      (acc, m) => {
        acc.calories += Number(m.calories || 0);
        acc.proteins += Number(m.protein || 0);
        acc.fats += Number(m.fat || 0);
        acc.carbs += Number(m.carbs || 0);
        return acc;
      },
      { calories: 0, proteins: 0, fats: 0, carbs: 0 },
    );

    const sortedMeals = [...filteredMeals].sort(
      (a, b) => new Date(b.date) - new Date(a.date),
    );
    setPeriodStats(total);
    setPeriodMeals(sortedMeals);
  };

  const startOfWeek = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1; // Mon=0..Sun=6
    d.setDate(d.getDate() - dow);
    return d;
  };

  const buildDayCell = (date, mealsToProcess) => {
    const dayMeals = mealsToProcess.filter(
      (m) => new Date(m.date).toDateString() === date.toDateString(),
    );
    const dayCals = dayMeals.reduce((s, m) => s + (m.calories || 0), 0);
    const stepDay = summarizeActivity(activity.history, periodWindow('day', date)).byDate.get(localDay(date));
    const dayNormCals = stepDay ? stepDay.baseGoal + stepDay.extra : getNormForDate(normHistory, date, dailyNorm).calories;
    let status =
      dayMeals.length > 0
        ? dayCals > dayNormCals
          ? "over"
          : "good"
        : "empty";
    if (date > new Date()) status = "future";
    return { date, day: date.getDate(), status };
  };

  const generateCalendar = (mealsToProcess) => {
    if (calendarExpanded) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

      let days = [];
      for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
      for (let d = 1; d <= lastDay.getDate(); d++) {
        days.push(buildDayCell(new Date(year, month, d), mealsToProcess));
      }
      setCalendarDays(days);
    } else {
      const start = startOfWeek(currentDate);
      let days = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        days.push(buildDayCell(d, mealsToProcess));
      }
      setCalendarDays(days);
    }
  };

  const stepCalendar = (delta) => {
    if (calendarExpanded) {
      setCurrentDate(
        new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + delta,
          1,
        ),
      );
    } else {
      const d = new Date(currentDate);
      d.setDate(currentDate.getDate() + delta * 7);
      setCurrentDate(d);
    }
  };

  const calendarTitle = () => {
    if (calendarExpanded) {
      return (
        currentDate.toLocaleString(i18n.language, { month: "long" }) +
        " " +
        currentDate.getFullYear()
      );
    }
    const start = startOfWeek(currentDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (d) =>
      d.toLocaleDateString(i18n.language, { day: "numeric", month: "short" });
    return `${fmt(start)} – ${fmt(end)}`;
  };

  const periodGoals = useMemo(() => {
    if (period === "day") {
      return getNormForDate(normHistory, selectedDay.date, dailyNorm);
    }
    const days = period === "week" ? 7 : period === "month" ? 30 : 365;
    return sumNormsForLastNDays(normHistory, days, new Date(), dailyNorm);
  }, [period, selectedDay.date, normHistory, dailyNorm]);
  // Saved historical base + same-day movement credit. Never add today's
  // steps to past days or extrapolate missing history.
  const historicalBase = [...activitySummary.byDate.values()].reduce((sum, day) =>
    sum + day.baseGoal - getNormForDate(normHistory, new Date(day.date + 'T12:00:00'), dailyNorm).calories, 0);
  const baseGoal = periodGoals.calories + historicalBase;
  const calGoal = baseGoal + activitySummary.extra;
  const proGoal = periodGoals.proteins;
  const fatGoal = periodGoals.fats;
  const carbGoal = periodGoals.carbs;
  const macros = [
    { key: "p", label: t("protein"), val: periodStats.proteins, goal: proGoal,  color: "var(--brand-lilac)" },
    { key: "f", label: t("fat"),     val: periodStats.fats,     goal: fatGoal,  color: "var(--brand-coral)" },
    { key: "c", label: t("carbs"),   val: periodStats.carbs,    goal: carbGoal, color: "var(--brand-peach)" },
  ];

  // ===== ЛОГІКА ОВЕРЛЕЮ (Редагування/Видалення) =====
  const openMealDetails = async (meal) => {
    setSelectedMeal({ ...meal, isNew: false, originalData: meal });
    setInputName(meal.name);
    setInputWeight(meal.weight);
    const cachedImg = meal.id in mealImagesCache ? mealImagesCache[meal.id] : null;
    setMealImageSrc(cachedImg);
    setShowResult(true);
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
  };

  const updateMealWeight = (newWeight) => {
    const baseData = selectedMeal.originalData || selectedMeal;
    if (!baseData || !baseData.weight) return;

    const targetWeight = parseFloat(newWeight);
    if (isNaN(targetWeight) || targetWeight <= 0) return;

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
        cal: ing.cal * factor,
        p: ing.p * factor,
        f: ing.f * factor,
        c: ing.c * factor,
      })),
    }));
  };

  const removeIngredient = (indexToRemove) => {
    if (!selectedMeal || !selectedMeal.ingredients) return;
    setConfirmDeleteIngIndex(indexToRemove);
  };

  const doRemoveIngredient = (indexToRemove) => {
    const removedIng = selectedMeal.ingredients[indexToRemove];
    const updatedIngredients = selectedMeal.ingredients.filter(
      (_, idx) => idx !== indexToRemove,
    );

    const newWeight = Math.max(
      0,
      selectedMeal.weight - (removedIng.weight || 0),
    );
    const newCals = Math.max(0, selectedMeal.calories - (removedIng.cal || 0));
    const newPro = Math.max(0, selectedMeal.protein - (removedIng.p || 0));
    const newFat = Math.max(0, selectedMeal.fat - (removedIng.f || 0));
    const newCarbs = Math.max(0, selectedMeal.carbs - (removedIng.c || 0));

    const updatedMeal = {
      ...selectedMeal,
      weight: newWeight,
      calories: newCals,
      protein: newPro,
      fat: newFat,
      carbs: newCarbs,
      ingredients: updatedIngredients,
      originalData: {
        ...selectedMeal.originalData,
        weight: newWeight,
        calories: newCals,
        protein: newPro,
        fat: newFat,
        carbs: newCarbs,
        ingredients: updatedIngredients,
      },
    };

    setSelectedMeal(updatedMeal);
    setInputWeight(f(newWeight).toString());
    setConfirmDeleteIngIndex(null);
  };

  const saveMeal = async () => {
    if (!selectedMeal) return;
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
        ingredients:
          selectedMeal.ingredients?.map((ing) => ({
            name: ing.name,
            weight: f(ing.weight),
            cal: f(ing.cal),
            p: f(ing.p),
            f: f(ing.f),
            c: f(ing.c),
            ...(ing.categoryKey ? { categoryKey: ing.categoryKey } : {}),
            ...(ing.ingredientKey ? { ingredientKey: ing.ingredientKey } : {}),
          })) || [],
      };

      const batch = writeBatch(db);
      batch.set(doc(db, "users", accountId, "meals", mealId), mealData);

      if (mealImageSrc) {
        batch.set(doc(db, "meal_images", mealId), {
          userId: user.uid,
          image: mealImageSrc,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });
      }

      await batch.commit();
      if (selectedMeal.isNew) trackMealAdded();
      // Fire-and-forget: enrich saved meal with category/ingredient keys.
      const lang = gramixStorage.get(STORAGE_KEYS.LANG) || i18n.language || "ru";
      categorizeAndPatchMeal(accountId, mealId, mealData.ingredients, lang).catch(
        (e) => console.warn("categorizeAndPatchMeal failed", e)
      );
      await fetchUserData(accountId); // Перезавантажуємо дані, щоб змінити статистику
      setShowResult(false);
    } catch {
      setErrorPopup(t('save_error'));
    }
  };

  const deleteMeal = () => {
    if (!selectedMeal) return;
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
      setErrorPopup(t('delete_error'));
    }
  };

  if (loading)
    return (
      <div className="page loading-screen">
        <h2>{t('loading')}</h2>
      </div>
    );

  if (loadFailed && !hasLoaded) return <LoadError onRetry={() => { setLoading(true); void fetchUserData(); }} />;

  return (
    <div className="stats-page" {...(showResult ? {} : swipeHandlers)}>
      <div className="stats-phone">
        {loadFailed && <LoadError inline onRetry={() => { void fetchUserData(); }} />}
        {/* Використовуємо єдиний клас шапки */}
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

        <div className="stats-content">
<div className="period-selector">
            {["day", "week", "month", "year"].map((p) => (
              <button
                key={p}
                className={period === p ? "active" : ""}
                onClick={() => setPeriod(p)}
              >
                {t(p)}
              </button>
            ))}
          </div>

          {period === "day" && (
            <div className="calendar-card">
              <div className="calendar-nav">
                <button
                  type="button"
                  className="calendar-toggle"
                  onClick={() => setCalendarExpanded((v) => !v)}
                  aria-expanded={calendarExpanded}
                >
                  <span style={{ textTransform: 'capitalize' }}>
                    {calendarTitle()}
                  </span>
                  <svg
                    className={`calendar-chev ${calendarExpanded ? 'open' : ''}`}
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <div className="nav-btns">
                  <button onClick={() => stepCalendar(-1)}>{"<"}</button>
                  <button onClick={() => stepCalendar(1)}>{">"}</button>
                </div>
              </div>
              <div className="calendar-grid">
                {t('weekdays', { returnObjects: true }).map((d) => (
                  <div key={d} className="weekday">
                    {d}
                  </div>
                ))}
                {calendarDays.map((d, i) => (
                  <div
                    key={i}
                    className={`calendar-day day-${d?.status || ""} ${d && selectedDay.date.toDateString() === d.date.toDateString() ? "selected" : ""}`}
                    onClick={() =>
                      d && d.status !== "future" && setSelectedDay(d)
                    }
                  >
                    {d?.day}
                  </div>
                ))}
              </div>
            </div>
          )}

              <CalorieOverview
                showStatus={false}
                personalAverage={averageExpenditure(budgetProfile,health.timezone===Intl.DateTimeFormat().resolvedOptions().timeZone?health.days:[])}
                averages={[diaryAverage(allMeals, period === 'day' ? periodWindow('week', selectedDay.date, selectedDay.date) : range)]}
                autoBudget={liveAccrual} goal={liveAccrual ? liveAccrual.accrued : calGoal} eaten={periodStats.calories} base={liveAccrual ? liveAccrual.resting : baseGoal} extra={liveAccrual ? liveAccrual.movement : activitySummary.extra}
                today={period === 'day' && localDay(selectedDay.date) === localDay()}>

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

          <div className="stats-tabs">
            <button
              className={`stats-tab ${statsTab === "ingredients" ? "is-active" : ""}`}
              onClick={() => setStatsTab("ingredients")}
            >
              {t("ingredients")}
            </button>
            <button
              className={`stats-tab ${statsTab === "dishes" ? "is-active" : ""}`}
              onClick={() => setStatsTab("dishes")}
            >
              {t("dishes")}
            </button>
          </div>

          {statsTab === "ingredients" && categoryStats.length > 0 && (
          <section className="category-breakdown">
            {categoryStats.map((cat) => {
              const isOpen = !!expandedCats[cat.categoryKey];
              const displayName =
                cat.categoryKey === UNCATEGORIZED
                  ? t('uncategorized')
                  : getCategoryName(cat.categoryKey, i18n.language);
              const m = getCatMetric(cat.categoryKey);
              const dropdownOpen = openCatMetric === cat.categoryKey;
              return (
                <div key={cat.categoryKey} className={`cat-row ${isOpen ? 'open' : ''}`}>
                  <button className="cat-header" onClick={() => toggleCategory(cat.categoryKey)}>
                    <div className="cat-header-left">
                      <span className={`cat-chevron ${isOpen ? 'open' : ''}`}>›</span>
                      <span className="cat-name">{displayName}</span>
                    </div>
<div className="cat-header-right">
                        <span className="cat-cals-total">{Math.round(cat.totalCalories)} {t('kcal')}</span>
                      </div>
                  </button>
                  {isOpen && (
                    <div className="cat-body">
                      <div className="cat-summary-row">
                        <div className="cat-summary-left">
                          <div className="cat-macro-item p">
                            <span className="cat-macro-dot-small" />
                            <span className="cat-macro-label">{t('protein_short')}</span>
                            <span className="cat-macro-val">{Math.round(cat.totalProtein)}{t('grams_unit')}</span>
                          </div>
                          <div className="cat-macro-item f">
                            <span className="cat-macro-dot-small" />
                            <span className="cat-macro-label">{t('fat_short')}</span>
                            <span className="cat-macro-val">{Math.round(cat.totalFat)}{t('grams_unit')}</span>
                          </div>
                          <div className="cat-macro-item c">
                            <span className="cat-macro-dot-small" />
                            <span className="cat-macro-label">{t('carbs_short')}</span>
                            <span className="cat-macro-val">{Math.round(cat.totalCarbs)}{t('grams_unit')}</span>
                          </div>
                        </div>
                        <div className="cat-summary-right">
                          <span className="cat-total-weight">{Math.round(cat.totalWeight)} {t('grams_unit')}</span>
                        </div>
                      </div>
                      <div className="cat-ing-table">
                        <div className="cat-ing-th">
                          <span>{t('ingredients')}</span>
                          <span className="th-weight">{t('weight')}</span>
                          <div className={`cat-kbju-dropdown ${dropdownOpen ? 'open' : ''}`}>
                            <button
                              type="button"
                              className="cat-kbju-dropdown-trigger"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenCatMetric(dropdownOpen ? null : cat.categoryKey);
                              }}
                            >
                              <span className="cat-kbju-dropdown-label">{METRIC_INFO[m].long}</span>
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>
                            {dropdownOpen && (
                              <>
                                <div className="cat-kbju-overlay" onClick={(e) => { e.stopPropagation(); setOpenCatMetric(null); }} />
                                <div className="cat-kbju-menu">
                                  {['cal', 'p', 'f', 'c'].map((k) => (
                                    <button
                                      key={k}
                                      type="button"
                                      className={`cat-kbju-item ${m === k ? 'active' : ''}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCatMetric(cat.categoryKey, k);
                                        setOpenCatMetric(null);
                                      }}
                                    >
                                      {METRIC_INFO[k].long}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        {cat.ingredients.map((ing, idx) => (
                          <div key={idx} className="cat-ing-row">
                            <span className="cat-ing-name">{getIngredientName(ing, i18n.language)}</span>
                            <span className="cat-ing-w">{Math.round(ing.weight)}</span>
                            <span className={`cat-ing-macro ${m}`}>
                              {Math.round(metricValue(ing, m))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {statsTab === "dishes" && periodMeals.length > 0 && (
            <div className="stats-meals-list">
              {periodMeals.slice(currentMealPage * 30, (currentMealPage + 1) * 30).map((meal, index) => {
                const d = new Date(meal.date || Date.now());
                const showFullDate = period !== 'day';
                return (
                  <article
                    key={meal.id || index}
                    className="stats-meal-card"
                    onClick={() => openMealDetails(meal)}
                  >
                    <MealThumbnail
                      mealId={meal.id}
                      fallback={errorPlateImg}
                      className="stats-meal-img"
                    />
                    <div className="stats-meal-body">
                      <h4 className="stats-meal-name">{getDishName(meal.name, i18n.language)}</h4>
                      <div className="stats-meal-meta">
                        <span className="stats-meal-cals">{f(meal.calories)} {t('kcal')}</span>
                        {meal.weight ? (
                          <span className="stats-meal-weight">
                            · {f(meal.weight)} {t('grams_unit')}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="stats-meal-time">
                      {showFullDate && (
                        <div className="stats-meal-date">
                          {d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })}
                        </div>
                      )}
                      <div className="stats-meal-clock">
                        {d.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </article>
                );
              })}
              {pageCount > 1 && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 16 }}>
                <button aria-label="Previous meals" disabled={currentMealPage === 0} onClick={() => setMealPage(currentMealPage - 1)}>←</button>
                <span>{currentMealPage + 1} / {pageCount}</span>
                <button aria-label="Next meals" disabled={currentMealPage + 1 >= pageCount} onClick={() => setMealPage(currentMealPage + 1)}>→</button>
              </div>}
            </div>
          )}
        </div>

        <HubNavigation />

        {/* Meal detail overlay — same layout as MainPage */}
        {showResult && selectedMeal && (
          <div
            className="result-overlay-full"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="meal-detail-page">
              <div className="md-hero">
                {mealImageSrc && mealImageSrc.length > 0 ? (
                  <img src={mealImageSrc} alt="" className="md-hero-img" />
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
                <div className="md-title-block">
                  <textarea
                    className="md-title-input"
                    value={inputName}
                    onChange={(e) => setInputName(e.target.value)}
                    rows={2}
                  />
                </div>

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

                <div className="md-ing-header">
                  <div className="md-ing-title">{t("ingredients")}</div>
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
                            {Math.round(ing.cal || ing.calories || 0)} {t("kcal")}
                          </span>
                        </div>
                        <div className="md-ing-tags">
                          {[
                            { k: "p", v: ing.p || ing.protein || 0, color: "var(--brand-lilac)" },
                            { k: "f", v: ing.f || ing.fat || 0,     color: "var(--brand-coral)" },
                            { k: "c", v: ing.c || ing.carbs || 0,   color: "var(--brand-peach)" },
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

              <div className="md-save-dock">
                <button className="md-delete-btn" onClick={deleteMeal}>
                  {t("delete")}
                </button>
                <button className="md-save-btn" onClick={saveMeal}>
                  {t("save")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Delete meal confirm ── */}
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

        {/* ── Generic error popup ── */}
        <BottomSheetPopup
          open={!!errorPopup}
          onClose={() => setErrorPopup(null)}
          variant="error"
          title={errorPopup || ''}
          primaryLabel={t('ok')}
          onPrimary={() => setErrorPopup(null)}
        />

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
                  className="delete-meal-btn-v2"
                  style={{ flex: 2 }}
                  onClick={() => doRemoveIngredient(confirmDeleteIngIndex)}
                >
                  {t("delete")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
