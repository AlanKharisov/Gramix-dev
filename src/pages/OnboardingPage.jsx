import React, { useState } from "react";
import { useNavigate } from '../hooks/useAppNavigate';
import { useTranslation } from "react-i18next";
import { auth, db } from "./firebase-config";
import { doc, setDoc } from "../services/firestoreCompat";
import "./onboarding.css";

const ONBOARDING_LS = "cs_onboarding_done";

const Slides = (t) => [
  {
    title: t("onb_camera_title"),
    desc: t("onb_camera_desc"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 4h-5L7 6.5H4a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 4 19.5h16a1.5 1.5 0 0 0 1.5-1.5V8A1.5 1.5 0 0 0 20 6.5h-3L14.5 4Z" />
        <circle cx="12" cy="13" r="3.6" />
      </svg>
    ),
  },
  {
    title: t("onb_analyze_title"),
    desc: t("onb_analyze_desc"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9" />
        <path d="M12 3v9l6 3" />
      </svg>
    ),
  },
  {
    title: t("onb_stats_title"),
    desc: t("onb_stats_desc"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 20V10M12 20V4M19 20v-7" />
      </svg>
    ),
  },
];

export default function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const slides = Slides(t);

  const finish = async () => {
    setBusy(true);
    try { localStorage.setItem(ONBOARDING_LS, "1"); } catch { /* ignore */ }
    const user = auth.currentUser;
    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid), { onboardingDone: true }, { merge: true });
      } catch (e) {
        console.warn("onboardingDone write failed", e);
      }
    }
    navigate("/main", { replace: true });
  };

  const next = () => {
    if (step < slides.length - 1) setStep(step + 1);
    else finish();
  };

  const slide = slides[step];

  return (
    <div className="onb-page">
      <div className="onb-glow" />

      <div className="onb-body">
        <div className="onb-icon">{slide.icon}</div>
        <h1 className="onb-title">{slide.title}</h1>
        <p className="onb-desc">{slide.desc}</p>
      </div>

      <div className="onb-dots">
        {slides.map((_, i) => (
          <span key={i} className={`onb-dot ${i === step ? "is-active" : ""}`} />
        ))}
      </div>

      <div className="onb-actions">
        <button className="onb-primary" onClick={next} disabled={busy}>
          {step < slides.length - 1 ? t("onb_next") : t("onb_start")}
        </button>
        <button className="onb-skip" onClick={finish} disabled={busy}>
          {t("skip")}
        </button>
      </div>
    </div>
  );
}
