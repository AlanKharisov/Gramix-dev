import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useNavigate } from '../hooks/useAppNavigate';
import { useTranslation } from "react-i18next";
import { auth, db } from "./firebase-config";
import { useSwipeNavigation } from "../hooks/useSwipeNavigation";
import { collection, getDocs, doc, getDoc } from "../services/firestoreCompat";
import "./main.css"; // ВАЖЛИВО: Використовуємо наш єдиний ідеальний CSS
import errorPlateImg from "../assets/gramix-preview.webp";

const PAGE_ORDER = ['/main', '/stats', '/history'];

const Icons = {
  Profile: () => <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>,
};

export default function HistoryPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const navWithDir = (to) => {
    const curr = PAGE_ORDER.indexOf(location.pathname);
    const dest = PAGE_ORDER.indexOf(to);
    navigate(to, { state: { direction: dest > curr ? 'left' : 'right' } });
  };
  const [period, setPeriod] = useState("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState([]);
  const [selectedDay, setSelectedDay] = useState({ date: new Date(), day: new Date().getDate() });
  
  const [allMeals, setAllMeals] = useState([]);
  const [displayIngredients, setDisplayIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dailyNorm, setDailyNorm] = useState({ calories: 2000 });
  const [dayMeals, setDayMeals] = useState([]);
  const [dayImagesCache, setDayImagesCache] = useState({});
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [fullscreenImgHeight, setFullscreenImgHeight] = useState(0);

  const { t, i18n } = useTranslation();
  const f = (num) => Math.round(Number(num || 0) * 10) / 10;
  const getIconColor = (path) => location.pathname === path ? "var(--brand-mint)" : "var(--text-mute)";
  const swipeHandlers = useSwipeNavigation(location.pathname);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) fetchUserData(user);
      else navigate("/");
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (allMeals.length >= 0) {
      if (period === "day") generateCalendar(allMeals);
      processIngredients(allMeals);
    }
  }, [period, currentDate, selectedDay, allMeals]);

  const fetchUserData = async (user) => {
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) setDailyNorm(userDoc.data().dailyNorm || { calories: 2000 });

      const snapshot = await getDocs(collection(db, "users", user.uid, "meals"));
      setAllMeals(snapshot.docs.map(d => ({ ...d.data(), id: d.id })));
    } catch (e) { console.error("Error fetching history:", e); }
    finally { setLoading(false); }
  };

  const fetchDayImages = async (meals) => {
    if (!meals.length) { setDayImagesCache({}); return; }
    const results = await Promise.allSettled(
      meals.map(m => getDoc(doc(db, "meal_images", m.id)).then(d => [m.id, d.exists() ? d.data().image : null]))
    );
    const cache = {};
    results.forEach(r => { if (r.status === "fulfilled") cache[r.value[0]] = r.value[1]; });
    setDayImagesCache(cache);
  };

  const processIngredients = (mealsToProcess) => {
    let filteredMeals = [];
    if (period === "day") {
      filteredMeals = mealsToProcess.filter(m => new Date(m.date).toDateString() === selectedDay.date.toDateString());
      setDayMeals(filteredMeals);
      fetchDayImages(filteredMeals);
    } else {
      setDayMeals([]);
      const now = new Date();
      let startDate = new Date();
      if (period === "week") startDate.setDate(now.getDate() - 7);
      else if (period === "month") startDate.setMonth(now.getMonth() - 1);
      else if (period === "year") startDate.setFullYear(now.getFullYear() - 1);
      filteredMeals = mealsToProcess.filter(m => new Date(m.date) >= startDate);
    }

    const ingMap = {};
    filteredMeals.forEach(meal => {
      // Якщо немає інгредієнтів, беремо макроси самої страви (підтримуємо обидва формати)
      const items = meal.ingredients && meal.ingredients.length > 0 
        ? meal.ingredients 
        : [{ 
            name: meal.name, 
            cal: meal.calories || meal.cal || 0, 
            p: meal.protein || meal.p || 0, 
            f: meal.fat || meal.f || 0, 
            c: meal.carbs || meal.c || 0, 
            weight: meal.weight || 0
          }];

      items.forEach(ing => {
        // Захист від порожніх імен
        const rawName = ing.name || "Невідомо";
        const name = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();
        
        if (!ingMap[name]) ingMap[name] = { name, cal: 0, p: 0, f: 0, c: 0, weight: 0 };
        
        // Зчитуємо або старі (короткі), або нові (довгі) ключі
        ingMap[name].cal += Number(ing.cal || ing.calories || 0);
        ingMap[name].p += Number(ing.p || ing.protein || 0);
        ingMap[name].f += Number(ing.f || ing.fat || 0);
        ingMap[name].c += Number(ing.c || ing.carbs || 0);
        ingMap[name].weight += Number(ing.weight || 0);
      });
    });

    setDisplayIngredients(Object.values(ingMap).sort((a, b) => b.cal - a.cal));
  };

  const generateCalendar = (mealsToProcess) => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    
    let days = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const dayMeals = mealsToProcess.filter(m => new Date(m.date).toDateString() === date.toDateString());
      const dayCals = dayMeals.reduce((s, m) => s + (m.calories || 0), 0);
      let status = dayMeals.length > 0 ? (dayCals > dailyNorm.calories ? "over" : "good") : "empty";
      if (date > new Date()) status = "future";
      days.push({ date, day: d, status });
    }
    setCalendarDays(days);
  };

  if (loading) return <div className="page loading-screen"><h2>{t('loading')}</h2></div>;

  return (
    <div className="history-page" {...swipeHandlers}>
      <div className="history-phone">
        
        <header className="main-header">
          <div className="main-header-text"><span className="red-part"><span className="mechanical-g">G</span>ramix</span></div>
          <div className="main-profile-btn" onClick={() => navigate("/profile")}><Icons.Profile /></div>
        </header>

        <div className="history-content">
          <div className="period-selector">
            {["day", "week", "month", "year"].map(p => (
              <button key={p} className={period === p ? "active" : ""} onClick={() => setPeriod(p)}>
                {t(p)}
              </button>
            ))}
          </div>

          {period === "day" && (
            <div className="calendar-card">
              <div className="calendar-nav">
                <h3 style={{ textTransform: 'capitalize' }}>
                  {currentDate.toLocaleString(i18n.language, { month: 'long' })} {currentDate.getFullYear()}
                </h3>
                <div className="nav-btns">
                  {/* ВИПРАВЛЕНО баг з перемиканням місяців */}
                  <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>{"<"}</button>
                  <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>{">"}</button>
                </div>
              </div>
              <div className="calendar-grid">
                {t('weekdays', { returnObjects: true }).map(d => <div key={d} className="weekday">{d}</div>)}
                {calendarDays.map((d, i) => (
                  <div key={i} className={`calendar-day day-${d?.status || ""} ${d && selectedDay.date.toDateString() === d.date.toDateString() ? "selected" : ""}`}
                    onClick={() => d && d.status !== "future" && setSelectedDay(d)}>
                    {d?.day}
                  </div>
                ))}
              </div>
            </div>
          )}

          {period === "day" && dayMeals.length > 0 && (
            <div className="history-day-meals">
              {dayMeals.map((meal) => {
                const img = dayImagesCache[meal.id];
                return (
                  <div key={meal.id} className="history-meal-card">
                    <img
                      src={img || errorPlateImg}
                      alt=""
                      className="history-meal-img"
                      onClick={() => img && setFullscreenImage(img)}
                      style={{ cursor: img ? "zoom-in" : "default" }}
                    />
                    <div className="history-meal-info">
                      <h4>{meal.name}</h4>
                      <p>{f(meal.calories)} {t('kcal')} · {f(meal.weight)} {t('grams_unit')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="ingredients-table-card">
            <div className="table-header">
              <span className="col-weight">{t('grams')}</span>
              <span className="col-name">{t('ingredient')}</span>
              <div className="col-metrics">
                <span>{t('kcal')}</span><span>{t('protein_short')}</span><span>{t('fat_short')}</span><span>{t('carbs_short')}</span>
              </div>
            </div>
            
            <div className="table-body">
              {displayIngredients.length === 0 ? (
                <div className="empty-msg">{t('no_data')}</div>
              ) : (
                displayIngredients.map((ing, idx) => (
                  <div key={idx} className="table-row">
                    <span className="ing-weight">{f(ing.weight)}</span>
                    <span className="ing-name-wrap">{ing.name}</span>
                    <div className="ing-metrics">
                      <span className="m-cal">{f(ing.cal)}</span>
                      <span className="m-val">{f(ing.p)}</span>
                      <span className="m-val">{f(ing.f)}</span>
                      <span className="m-val">{f(ing.c)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <nav className="main-bottom-nav">
          <div className="nav-icon-wrapper" onClick={() => navWithDir("/main")}><svg viewBox="0 0 24 24" width="28" height="28" fill={getIconColor("/main")}><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg></div>
          <div className="nav-icon-wrapper" onClick={() => navWithDir("/stats")}><svg viewBox="0 0 24 24" width="28" height="28" fill={getIconColor("/stats")}><path d="M5 9.2h3V19H5zM10.6 5h2.8V19h-2.8zm5.6 8H19v6h-2.8z" /></svg></div>
          <div className="nav-icon-wrapper" onClick={() => navWithDir("/history")}><svg viewBox="0 0 24 24" width="28" height="28" fill={getIconColor("/history")}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" /></svg></div>
        </nav>

        {/* ── Fullscreen photo popup ── */}
        {fullscreenImage && (
          <div className="photo-fullscreen-overlay" onClick={() => setFullscreenImage(null)}>
            <button 
              className="photo-fullscreen-close" 
              style={{ top: fullscreenImgHeight > 0 ? Math.min(fullscreenImgHeight * 0.15, 80) + 20 : 60 }}
              onClick={() => setFullscreenImage(null)}
            >×</button>
            <img
              src={fullscreenImage}
              alt=""
              className="photo-fullscreen-img"
              onClick={(e) => e.stopPropagation()}
              onLoad={(e) => setFullscreenImgHeight(e.target.clientHeight)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
