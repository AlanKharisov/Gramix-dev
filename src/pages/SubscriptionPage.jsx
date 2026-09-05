import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { auth, db } from "./firebase-config";
import { doc, getDoc } from "../services/firestoreCompat";
import { PLANS, startPurchase, restorePurchases } from "../services/purchases";
import "./subscription.css";

export default function SubscriptionPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [selected, setSelected] = useState("yearly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [premium, setPremium] = useState(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists() && snap.data().premium === true) {
          setPremium({
            plan: snap.data().premiumPlan,
            expiresAt: snap.data().premiumExpiresAt,
          });
        }
      } catch (e) {
        console.warn("read premium status failed", e);
      }
    })();
  }, []);

  const handleSubscribe = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await startPurchase(selected);
      // Show success immediately based on RC's confirmed entitlement; the
      // RevenueCat webhook will mirror premium=true into Firestore (and bump
      // photoLimit/editLimit) within a few seconds.
      setPremium({ plan: res.plan, expiresAt: res.expiresAt.toISOString() });
    } catch (e) {
      console.warn("purchase failed", e);
      setError(t("purchase_failed"));
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async () => {
    setBusy(true);
    setError("");
    try {
      await restorePurchases();
    } catch (e) {
      console.warn("restore failed", e);
    } finally {
      setBusy(false);
    }
  };

  const fmtDate = (iso) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString(i18n.language, {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  return (
    <div className="sub-page">
      <header className="main-header">
        <button
          className="sub-back-btn"
          onClick={() => navigate(-1)}
          aria-label="back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="main-header-text">
          <span className="red-part"><span className="mechanical-g">G</span>ramix</span>
        </div>
        <div style={{ width: 40 }} />
      </header>

      <div className="sub-body">
        <div className="sub-hero">
          <div className="sub-hero-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4.5L6 21l1.5-7.5L2 9h7z" />
            </svg>
          </div>
          <h1 className="sub-title">{t("premium_title")}</h1>
          <p className="sub-desc">{t("premium_desc")}</p>
        </div>

        {premium ? (
          <div className="sub-active-card">
            <div className="sub-active-badge">{t("premium_active")}</div>
            <div className="sub-active-until">
              {t("premium_until", { date: fmtDate(premium.expiresAt) })}
            </div>
          </div>
        ) : (
          <>
            <div className="sub-plans">
              <button
                type="button"
                className={`sub-plan-card ${selected === "yearly" ? "is-active" : ""}`}
                onClick={() => setSelected("yearly")}
              >
                <div className="sub-plan-head">
                  <span className="sub-plan-name">{t("plan_yearly")}</span>
                  <span className="sub-plan-save">{t("plan_yearly_save")}</span>
                </div>
                <div className="sub-plan-price">
                  {t("uah_per_year", { n: PLANS.yearly.priceUah })}
                </div>
                <div className="sub-plan-equiv">
                  ≈ {Math.round(PLANS.yearly.priceUah / 12)} {t("per_month")}
                </div>
              </button>

              <button
                type="button"
                className={`sub-plan-card ${selected === "monthly" ? "is-active" : ""}`}
                onClick={() => setSelected("monthly")}
              >
                <div className="sub-plan-head">
                  <span className="sub-plan-name">{t("plan_monthly")}</span>
                </div>
                <div className="sub-plan-price">
                  {t("uah_per_month", { n: PLANS.monthly.priceUah })}
                </div>
                <div className="sub-plan-equiv">{t("per_month")}</div>
              </button>
            </div>

            {error && <div className="sub-error">{error}</div>}

            <button
              className="sub-cta"
              onClick={handleSubscribe}
              disabled={busy}
            >
              {busy ? t("loading") : t("subscribe")}
            </button>
            <button
              className="sub-restore"
              onClick={handleRestore}
              disabled={busy}
            >
              {t("restore_purchases")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
