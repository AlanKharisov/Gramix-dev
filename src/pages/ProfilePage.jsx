import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useNavigate } from '../hooks/useAppNavigate';
import { useTranslation } from "react-i18next";
import { auth, db } from "./firebase-config";
import { signOut, deleteUser } from "firebase/auth";
import { doc, getDoc, setDoc } from "../services/firestoreCompat";
import { appendNormHistory } from "../services/normHistory";
import { ensureAccount, getAccountId, clearAccountCache } from "../services/account";
import { PRIVACY_POLICY_URL } from "../config";
import ConfirmModal from "../components/ConfirmModal";
import BottomSheetPopup from "../components/BottomSheetPopup";
import { gramixStorage, STORAGE_KEYS } from "../utils/storage";
import { apiFetchWithToken } from "../services/apiClient";
import "./main.css";
import "./profile.css";
import ProfileExtras from '../components/ProfileExtras';

const LANGUAGES = [
  { code: 'uk', label: 'Українська', flag: '🇺🇦' },
  { code: 'en', label: 'English',    flag: '🇬🇧' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
  { code: 'ru', label: 'Русский',    flag: '🇷🇺' },
  { code: 'de', label: 'Deutsch',    flag: '🇩🇪' },
  { code: 'ja', label: '日本語',      flag: '🇯🇵' },
  { code: 'zh', label: '中文',        flag: '🇨🇳' },
  { code: 'pl', label: 'Polski',     flag: '🇵🇱' },
];

const ChevR = () => (
  <svg className="profile-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ACTIVITY_LEVELS = [
  { key: "sedentary",   coef: 1.2,   labelKey: "activity_sedentary" },
  { key: "light",       coef: 1.375, labelKey: "activity_light" },
  { key: "moderate",    coef: 1.55,  labelKey: "activity_moderate" },
  { key: "active",      coef: 1.725, labelKey: "activity_active" },
  { key: "very_active", coef: 1.9,   labelKey: "activity_very_active" },
];

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRelogin, setConfirmRelogin] = useState(false);
  const [showProfileUpdated, setShowProfileUpdated] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const [data, setData] = useState({
    gender: "male",
    age: 25,
    height: 175,
    weight: 70,
    goal: "maintain",
    activityLevel: "moderate",
    language: gramixStorage.get(STORAGE_KEYS.LANG) || 'ru',
    dailyNorm: { calories: 2000 }
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const accountId = await ensureAccount(user);
          if (accountId) await fetchUserData(accountId);
          else setLoading(false);
        } catch { setLoadFailed(true); setLoading(false); }
      } else {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const fetchUserData = async (accountId) => {
    try {
      setLoadFailed(false);
      if (!accountId) accountId = await ensureAccount(auth.currentUser);
      const userDoc = await getDoc(doc(db, "users", accountId));
      if (userDoc.exists()) {
        setData(prev => ({ ...prev, ...userDoc.data() }));
      }
    } catch (e) { setLoadFailed(true); console.error(e); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    const w = parseFloat(data.weight);
    const h = parseFloat(data.height);
    const a = parseInt(data.age);

    let bmr = (data.gender === "male")
      ? (10 * w) + (6.25 * h) - (5 * a) + 5
      : (10 * w) + (6.25 * h) - (5 * a) - 161;

    const coef = ACTIVITY_LEVELS.find((l) => l.key === data.activityLevel)?.coef ?? 1.55;
    let tdee = Math.round(bmr * coef);

    if (data.goal === "lose") tdee -= 500;
    if (data.goal === "gain") tdee += 500;

    const updatedNorm = {
      calories: tdee,
      proteins: Math.round((tdee * 0.25) / 4),
      fats: Math.round((tdee * 0.25) / 9),
      carbs: Math.round((tdee * 0.50) / 4)
    };

    // Write only the fields ProfilePage owns. Spreading {...data} would also
    // send premium/photoLimit/editLimit/blocked back to Firestore; rules
    // (intentionally) reject client writes to those, so an unrelated profile
    // save would fail after a webhook updates entitlement.
    const profileUpdate = {
      gender: data.gender,
      age: data.age,
      height: data.height,
      weight: data.weight,
      goal: data.goal,
      activityLevel: data.activityLevel,
      language: data.language,
      dailyNorm: updatedNorm,
    };
    try {
      const accountId = await getAccountId();
      await setDoc(doc(db, "users", accountId), profileUpdate, { merge: true });
      try { await appendNormHistory(accountId, updatedNorm, { goal: data.goal || null }); } catch (err) { console.warn("appendNormHistory failed", err); }
      setData(prev => ({ ...prev, dailyNorm: updatedNorm }));
      gramixStorage.set(STORAGE_KEYS.LANG, data.language);
      i18n.changeLanguage(data.language);
      setShowProfileUpdated(true);
    } catch { alert(t('error')); }
  };

  const performAccountDeletion = async (user) => {
    const token = await user.getIdToken(true);
    await deleteUser(user);
    try {
      await apiFetchWithToken("/account", token, { method: "DELETE" });
    } catch (error) {
      // Authentication is already removed; keep navigation responsive and
      // leave a diagnostic for server-side orphan cleanup if it ever fails.
      console.error("Account data cleanup failed:", error);
    }
    clearAccountCache();
    navigate("/", { replace: true });
  };

  const runDeleteAccount = async () => {
    setConfirmDelete(false);
    const user = auth.currentUser;
    if (!user) return;
    try {
      await performAccountDeletion(user);
    } catch (e) {
      if (e.code === "auth/requires-recent-login") {
        setConfirmRelogin(true);
      } else {
        alert(t('error'));
        console.error(e);
      }
    }
  };

  if (loading) return <div className="loading-screen"><h2>{t('loading')}</h2></div>;
  if (loadFailed) return <div className="loading-screen" role="alert"><h2>{t('error')}</h2>
    <button onClick={() => { setLoading(true); void fetchUserData(); }}>{t('popup_retry')}</button></div>;

  const userEmail = auth.currentUser?.email || '';
  const currentLangLabel = LANGUAGES.find(l => l.code === data.language)?.label || 'Русский';
  const normCalories = data.dailyNorm?.calories || 0;

  return (
    <div className="profile-page">
      <div className="profile-phone">

        <header className="main-header">
          <div className="main-header-text"><span className="red-part"><span className="mechanical-g">G</span>ramix</span></div>
          <div className="main-profile-btn">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="var(--brand-mint)"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </div>
        </header>

        <div className="profile-scroll">

          {/* Hero */}
          <div className="profile-hero">
            <div className="profile-hero-label">{t('section_account')}</div>
            <div className="profile-hero-email">{userEmail}</div>
            <div className="profile-norm-pill">
              <span className="profile-norm-dot" />
              <span>{normCalories.toLocaleString()} {t('kcal')} · {t('norm_label')}</span>
            </div>
          </div>

          {/* Параметры тела */}
          <div className="profile-section-header">{t('section_body')}</div>
          <div className="profile-tiles">
            <label className="profile-tile">
              <div className="profile-tile-label">{t('age')}</div>
              <div className="profile-tile-row">
                <input
                  type="number"
                  inputMode="numeric"
                  className="profile-tile-input"
                  value={data.age}
                  onChange={e => setData({ ...data, age: e.target.value })}
                />
                <span className="profile-tile-unit">{t('unit_years')}</span>
              </div>
            </label>
            <label className="profile-tile">
              <div className="profile-tile-label">{t('weight')}</div>
              <div className="profile-tile-row">
                <input
                  type="number"
                  inputMode="numeric"
                  className="profile-tile-input"
                  value={data.weight}
                  onChange={e => setData({ ...data, weight: e.target.value })}
                />
                <span className="profile-tile-unit">{t('unit_kg')}</span>
              </div>
            </label>
            <label className="profile-tile">
              <div className="profile-tile-label">{t('body_height')}</div>
              <div className="profile-tile-row">
                <input
                  type="number"
                  inputMode="numeric"
                  className="profile-tile-input"
                  value={data.height}
                  onChange={e => setData({ ...data, height: e.target.value })}
                />
                <span className="profile-tile-unit">{t('unit_cm')}</span>
              </div>
            </label>
          </div>

          {/* О себе */}
          <div className="profile-section-header">{t('section_about')}</div>
          <div className="profile-group">
            <div className="profile-segrow">
              <span className="profile-segrow-label">{t('gender')}</span>
              <div className="profile-segctrl">
                <button
                  type="button"
                  className={`profile-segbtn ${data.gender === 'male' ? 'is-active' : ''}`}
                  onClick={() => setData({ ...data, gender: 'male' })}
                >{t('male')}</button>
                <button
                  type="button"
                  className={`profile-segbtn ${data.gender === 'female' ? 'is-active' : ''}`}
                  onClick={() => setData({ ...data, gender: 'female' })}
                >{t('female')}</button>
              </div>
            </div>
            <div className="profile-segrow profile-segrow--last">
              <span className="profile-segrow-label">{t('goal')}</span>
              <div className="profile-segctrl">
                <button
                  type="button"
                  className={`profile-segbtn ${data.goal === 'lose' ? 'is-active' : ''}`}
                  onClick={() => setData({ ...data, goal: 'lose' })}
                >{t('goal_lose')}</button>
                <button
                  type="button"
                  className={`profile-segbtn ${data.goal === 'maintain' ? 'is-active' : ''}`}
                  onClick={() => setData({ ...data, goal: 'maintain' })}
                >{t('goal_maintain')}</button>
              </div>
            </div>
          </div>

          {/* Уровень активности */}
          <div className="profile-section-header">{t('activity_label')}</div>
          <div className="profile-group profile-activity-group">
            {ACTIVITY_LEVELS.map((lvl) => (
              <button
                key={lvl.key}
                type="button"
                className={`profile-row profile-activity-row ${data.activityLevel === lvl.key ? 'is-active' : ''}`}
                onClick={() => setData({ ...data, activityLevel: lvl.key })}
              >
                <span className="profile-row-label">{t(lvl.labelKey)}</span>
                {data.activityLevel === lvl.key && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Предпочтения — только Язык */}
          <div className="profile-section-header">{t('section_preferences')}</div>
          <div className="profile-group">
            <button
              type="button"
              className="profile-row profile-row--last profile-row--link"
              onClick={() => setShowLangPicker(true)}
            >
              <span className="profile-row-label">{t('language_label')}</span>
              <span className="profile-row-value">
                {LANGUAGES.find(l => l.code === data.language)?.flag} {currentLangLabel}
              </span>
              <ChevR />
            </button>
          </div>

          <ProfileExtras />
          {/* Подписка — раздел временно отключён */}
          {/*
          <div className="profile-section-header">{t('subscription')}</div>
          <div className="profile-group">
            <button
              type="button"
              className="profile-row profile-row--last profile-row--link"
              onClick={() => navigate('/subscription')}
            >
              <span className="profile-row-label">{t('premium_title')}</span>
              <span className="profile-row-value">
                {data.premium === true ? t('premium_active') : ''}
              </span>
              <ChevR />
            </button>
          </div>
          */}

          {/* Поддержка — только Политика */}
          <div className="profile-section-header">{t('section_support')}</div>
          <div className="profile-group">
            <button
              type="button"
              className="profile-row profile-row--last profile-row--link"
              onClick={() => window.open(PRIVACY_POLICY_URL, '_system')}
            >
              <span className="profile-row-label">{t('privacy_policy')}</span>
              <ChevR />
            </button>
          </div>

          {/* Save */}
          <div className="profile-save-wrap">
            <button type="button" className="profile-save-btn" onClick={handleSave}>
              {t('save')}
            </button>
          </div>

          {/* Версия */}
          <div className="profile-version">Gramix · v1.0</div>

          {/* Управление аккаунтом */}
          <div className="profile-danger">
            <button
              type="button"
              className="profile-danger-toggle"
              onClick={() => setDangerOpen(!dangerOpen)}
            >
              <span>{t('manage_account')}</span>
              <span className={`profile-danger-caret ${dangerOpen ? 'is-open' : ''}`}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </span>
            </button>

            {dangerOpen && (
              <div className="profile-danger-panel">
                <button type="button" className="profile-danger-row" onClick={() => setConfirmLogout(true)}>
                  <span className="profile-danger-icon profile-danger-icon--neutral">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                  </span>
                  <div className="profile-danger-text">
                    <div className="profile-danger-title">{t('logout')}</div>
                    <div className="profile-danger-sub">{t('logout_desc')}</div>
                  </div>
                  <ChevR />
                </button>
                <div className="profile-danger-divider" />
                <button type="button" className="profile-danger-row profile-danger-row--coral" onClick={() => setConfirmDelete(true)}>
                  <span className="profile-danger-icon profile-danger-icon--coral">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6"/>
                      <path d="M14 11v6"/>
                    </svg>
                  </span>
                  <div className="profile-danger-text">
                    <div className="profile-danger-title">{t('delete_account')}</div>
                    <div className="profile-danger-sub">{t('delete_account_desc')}</div>
                  </div>
                  <ChevR />
                </button>
              </div>
            )}
          </div>

        </div>

        <nav className="home-tabbar">
          <div className="home-tabbar-inner">
            <button
              className={`home-tab${location.pathname === "/main" ? " is-active" : ""}`}
              onClick={() => navigate("/main")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2v-9z" />
              </svg>
              {location.pathname === "/main" && <span>{t("nav_home")}</span>}
            </button>
            <button
              className={`home-tab${location.pathname === "/stats" ? " is-active" : ""}`}
              onClick={() => navigate("/stats")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 20V10M12 20V4M19 20v-7" />
              </svg>
              {location.pathname === "/stats" && <span>{t("nav_stats")}</span>}
            </button>
          </div>
        </nav>
      </div>

      <ConfirmModal
        isOpen={confirmLogout}
        message={t('logout_confirm')}
        confirmLabel={t('logout')}
        onConfirm={() => { setConfirmLogout(false); clearAccountCache(); signOut(auth); }}
        onCancel={() => setConfirmLogout(false)}
      />

      <ConfirmModal
        isOpen={confirmDelete}
        message={t('delete_account_confirm')}
        confirmLabel={t('delete_account')}
        destructive
        onConfirm={runDeleteAccount}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmModal
        isOpen={confirmRelogin}
        message={t('relogin_required')}
        confirmLabel={t('ok')}
        onConfirm={() => { setConfirmRelogin(false); signOut(auth); }}
        onCancel={() => setConfirmRelogin(false)}
      />

      <BottomSheetPopup
        open={showProfileUpdated}
        onClose={() => setShowProfileUpdated(false)}
        variant="info"
        title={t('profile_updated')}
        primaryLabel={t('ok')}
        onPrimary={() => setShowProfileUpdated(false)}
      />

      {showLangPicker && (
        <div className="lang-picker-overlay" onClick={() => setShowLangPicker(false)}>
          <div className="lang-picker-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="lang-picker-title">{t('language_label')}</h3>
            <div className="lang-picker-list">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  type="button"
                  className={`lang-picker-item${lang.code === data.language ? ' is-active' : ''}`}
                  onClick={() => {
                    setData({ ...data, language: lang.code });
                    setShowLangPicker(false);
                  }}
                >
                  <span className="lang-picker-flag">{lang.flag}</span>
                  <span className="lang-picker-label">{lang.label}</span>
                  {lang.code === data.language && (
                    <svg className="lang-picker-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12l5 5 9-12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
