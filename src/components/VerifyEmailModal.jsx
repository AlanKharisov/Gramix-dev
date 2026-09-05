import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { doc, setDoc } from "../services/firestoreCompat";
import { auth, db } from "../pages/firebase-config";
import { reload, sendEmailVerification } from "firebase/auth";
import {
  startResendCooldown,
  getResendSecondsLeft,
  formatMMSS,
} from "../utils/verifyCooldown";
import { ensureAccount } from "../services/account";
import "./VerifyEmailModal.css";

export default function VerifyEmailModal({ isOpen, email, uid, initialError, onVerified, onBack }) {
  const { t } = useTranslation();
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setError(initialError ? t("verification_send_failed") : "");
  }, [isOpen, initialError, t]);

  useEffect(() => {
    if (!isOpen || !uid) return;
    let cancelled = false;
    let checking = false;
    const check = async () => {
      if (checking || cancelled) return;
      const user = auth.currentUser;
      if (!user || user.uid !== uid) return;
      checking = true;
      try {
        await reload(user);
        if (user.emailVerified) {
          const accountId = await ensureAccount(user);
          if (accountId) {
            await setDoc(doc(db, "users", accountId), { emailVerified: true }, { merge: true });
          }
          if (!cancelled) onVerified?.();
        }
      } catch { /* retry on the next poll */ }
      checking = false;
    };
    check();
    const id = setInterval(check, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isOpen, uid, onVerified]);

  useEffect(() => {
    if (!isOpen || !uid) return;
    const tick = () => setSecondsLeft(getResendSecondsLeft(uid));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isOpen, uid]);

  if (!isOpen) return null;

  const resend = async () => {
    if (!uid || !email || secondsLeft > 0) return;
    setResending(true);
    setError("");
    try {
      const user = auth.currentUser;
      if (!user || user.uid !== uid) throw new Error("authentication_required");
      await sendEmailVerification(user);
      startResendCooldown(uid);
      setSecondsLeft(getResendSecondsLeft(uid));
    } catch {
      setError(t("verification_send_failed"));
    } finally {
      setResending(false);
    }
  };

  const ready = secondsLeft <= 0 && !resending;

  return (
    <div className="verify-screen">
      <div className="verify-blob" />

      <div className="verify-topbar">
        <button className="verify-back" onClick={onBack} aria-label="back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      <div className="verify-body">
        <div className="verify-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0E1410" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="3" />
            <path d="M3 7l9 6 9-6" />
          </svg>
        </div>

        <h1 className="verify-title">{t("verify_email_title")}</h1>
        <p className="verify-sub">
          {t("check_your_inbox")}
          <br />
          <strong>{email}</strong>
        </p>

        <div className="verify-hint">{t("verify_hint")}</div>

        {error && <p className="verify-error">{error}</p>}
      </div>

      <div className="verify-actions">
        <button
          className={`verify-resend${ready ? "" : " is-cooling"}`}
          onClick={resend}
          disabled={!ready}
        >
          {ready ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                <polyline points="21 3 21 8 16 8" />
              </svg>
              {t("resend_email")}
            </>
          ) : (
            <>
              <span className="verify-resend-label">{t("resend_email")}</span>
              <span className="verify-resend-pill">{formatMMSS(secondsLeft)}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
