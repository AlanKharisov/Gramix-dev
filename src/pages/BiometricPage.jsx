import React, { useState } from "react";
import { useNavigate } from '../hooks/useAppNavigate';
import { useTranslation } from "react-i18next";
import { db } from "./firebase-config";
import { doc, setDoc } from "../services/firestoreCompat";
import { appendNormHistory } from "../services/normHistory";
import { getAccountId } from "../services/account";
import "./main.css";
import "./profile.css";

const ACTIVITY_LEVELS = [
  { key: "sedentary",   coef: 1.2,   labelKey: "activity_sedentary" },
  { key: "light",       coef: 1.375, labelKey: "activity_light" },
  { key: "moderate",    coef: 1.55,  labelKey: "activity_moderate" },
  { key: "active",      coef: 1.725, labelKey: "activity_active" },
  { key: "very_active", coef: 1.9,   labelKey: "activity_very_active" },
];

export default function BiometricPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [data, setData] = useState({
    gender: "male",
    goal: "maintain",
    activityLevel: "moderate",
    age: "",
    height: "",
    weight: "",
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!data.age || !data.height || !data.weight) {
      alert(t("fill_fields_error"));
      return;
    }
    setLoading(true);
    try {
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

      const dailyNorm = {
        calories: tdee,
        proteins: Math.round((tdee * 0.25) / 4),
        fats: Math.round((tdee * 0.25) / 9),
        carbs: Math.round((tdee * 0.50) / 4),
      };

      const accountId = await getAccountId();
      await setDoc(doc(db, "users", accountId), {
        gender: data.gender,
        goal: data.goal,
        activityLevel: data.activityLevel,
        age: a,
        height: h,
        weight: w,
        dailyNorm,
        profileCompleted: true,
      }, { merge: true });

      try { await appendNormHistory(accountId, dailyNorm, { goal: data.goal }); }
      catch (err) { console.warn("appendNormHistory failed", err); }

      navigate("/main", { replace: true });
    } catch (e) {
      alert(t("save_error") + ": " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-phone">

        <header className="main-header">
          <div className="main-header-text"><span className="red-part"><span className="mechanical-g">G</span>ramix</span></div>
        </header>

        <div className="profile-scroll">

          {/* Hero */}
          <div className="profile-hero">
            <div className="profile-hero-label">{t("biometric_title")}</div>
            <div className="profile-hero-email">{t("biometric_desc")}</div>
          </div>

          {/* Параметры тела — tiles age / weight / height */}
          <div className="profile-section-header">{t("section_body")}</div>
          <div className="profile-tiles">
            <label className="profile-tile">
              <div className="profile-tile-label">{t("age")}</div>
              <div className="profile-tile-row">
                <input
                  type="number"
                  inputMode="numeric"
                  className="profile-tile-input"
                  value={data.age}
                  onChange={e => setData({ ...data, age: e.target.value })}
                />
                <span className="profile-tile-unit">{t("unit_years")}</span>
              </div>
            </label>
            <label className="profile-tile">
              <div className="profile-tile-label">{t("weight")}</div>
              <div className="profile-tile-row">
                <input
                  type="number"
                  inputMode="numeric"
                  className="profile-tile-input"
                  value={data.weight}
                  onChange={e => setData({ ...data, weight: e.target.value })}
                />
                <span className="profile-tile-unit">{t("unit_kg")}</span>
              </div>
            </label>
            <label className="profile-tile">
              <div className="profile-tile-label">{t("body_height")}</div>
              <div className="profile-tile-row">
                <input
                  type="number"
                  inputMode="numeric"
                  className="profile-tile-input"
                  value={data.height}
                  onChange={e => setData({ ...data, height: e.target.value })}
                />
                <span className="profile-tile-unit">{t("unit_cm")}</span>
              </div>
            </label>
          </div>

          {/* О себе — gender + goal segmented controls */}
          <div className="profile-section-header">{t("section_about")}</div>
          <div className="profile-group">
            <div className="profile-segrow">
              <span className="profile-segrow-label">{t("gender")}</span>
              <div className="profile-segctrl">
                <button
                  type="button"
                  className={`profile-segbtn ${data.gender === "male" ? "is-active" : ""}`}
                  onClick={() => setData({ ...data, gender: "male" })}
                >{t("male")}</button>
                <button
                  type="button"
                  className={`profile-segbtn ${data.gender === "female" ? "is-active" : ""}`}
                  onClick={() => setData({ ...data, gender: "female" })}
                >{t("female")}</button>
              </div>
            </div>
            <div className="profile-segrow profile-segrow--last">
              <span className="profile-segrow-label">{t("goal")}</span>
              <div className="profile-segctrl">
                <button
                  type="button"
                  className={`profile-segbtn ${data.goal === "lose" ? "is-active" : ""}`}
                  onClick={() => setData({ ...data, goal: "lose" })}
                >{t("goal_lose")}</button>
                <button
                  type="button"
                  className={`profile-segbtn ${data.goal === "maintain" ? "is-active" : ""}`}
                  onClick={() => setData({ ...data, goal: "maintain" })}
                >{t("goal_maintain")}</button>
              </div>
            </div>
          </div>

          {/* Уровень активности */}
          <div className="profile-section-header">{t("activity_label")}</div>
          <div className="profile-group profile-activity-group">
            {ACTIVITY_LEVELS.map((lvl) => (
              <button
                key={lvl.key}
                type="button"
                className={`profile-row profile-activity-row ${data.activityLevel === lvl.key ? "is-active" : ""}`}
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

          {/* Save */}
          <div className="profile-save-wrap">
            <button type="button" className="profile-save-btn" onClick={handleSave} disabled={loading}>
              {loading ? t("saving") : t("save")}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
