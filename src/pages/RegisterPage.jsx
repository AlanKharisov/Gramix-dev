import React, { useState } from "react";
import { useNavigate } from '../hooks/useAppNavigate';
import { useTranslation } from "react-i18next";
import { auth, db } from "./firebase-config";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from "firebase/auth";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { Capacitor } from "@capacitor/core";
import { doc, getDoc, setDoc, serverTimestamp } from "../services/firestoreCompat";
import { useVerifyModal } from "../contexts/VerifyModalContext";
import { startResendCooldown } from "../utils/verifyCooldown";
import PrivacyPolicyModal from "../components/PrivacyPolicyModal";
import { ensureAccount } from "../services/account";
import { gramixStorage, STORAGE_KEYS } from "../utils/storage";
import "./auth-form.css";

const POLICY_FLAG = STORAGE_KEYS.POLICY_ACCEPTED;

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { show: showVerifyModal } = useVerifyModal();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [ageOk, setAgeOk] = useState(false);
  const [policyOk, setPolicyOk] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selectedLang = gramixStorage.get(STORAGE_KEYS.LANG) || i18n.language || "ru";

  const sendVerification = async (user) => {
    try {
      await sendEmailVerification(user);
      startResendCooldown(user.uid);
      return true;
    } catch {
      return false;
    }
  };

  const describeAuthError = (err) => {
    const code = err?.code || "";
    const map = {
      "auth/email-already-in-use": t("err_email_taken"),
      "auth/invalid-email": t("err_invalid_email"),
      "auth/weak-password": t("err_weak_password"),
      "auth/network-request-failed": t("err_network"),
      "auth/operation-not-allowed": t("err_op_disabled"),
      "auth/too-many-requests": t("err_too_many"),
    };
    return map[code] || `${t("error")}: ${code || err?.message || ""}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ageOk) { setError(t("must_confirm_age")); return; }
    if (!policyOk) { setError(t("must_agree_policy")); return; }
    setLoading(true);
    setError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // Stash plaintext for BiometricSetupPage; cleared after enroll succeeds.
      try { localStorage.setItem("cs_recent_pwd", password); } catch { /* ignore */ }
      const accountId = await ensureAccount(cred.user);
      await setDoc(doc(db, "users", accountId), {
        email,
        language: selectedLang,
        createdAt: new Date().toISOString(),
        profileCompleted: false,
        emailVerified: false,
        privacyAcceptedAt: serverTimestamp(),
        isOver16: true,
      }, { merge: true });
      const sentOk = await sendVerification(cred.user);
      showVerifyModal(email, cred.user.uid, !sentOk);
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!ageOk) { setError(t("must_confirm_age")); return; }
    if (!policyOk) { setError(t("must_agree_policy")); return; }
    setError("");
    try {
      let firebaseUser;
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle();
        const idToken = result.credential?.idToken;
        if (!idToken) throw new Error("no_id_token");
        const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
        firebaseUser = cred.user;
      } else {
        const provider = new GoogleAuthProvider();
        const cred = await signInWithPopup(auth, provider);
        firebaseUser = cred.user;
      }
      const accountId = await ensureAccount(firebaseUser);
      const ref = doc(db, "users", accountId);
      const snap = await getDoc(ref);
      if (!snap.exists() || !snap.data()?.email) {
        await setDoc(ref, {
          email: firebaseUser.email,
          language: selectedLang,
          createdAt: new Date().toISOString(),
          profileCompleted: false,
          emailVerified: true,
          privacyAcceptedAt: serverTimestamp(),
          isOver16: true,
        }, { merge: true });
        navigate("/biometric");
      } else {
        const data = snap.data();
        navigate(data.profileCompleted ? "/main" : "/biometric");
      }
    } catch (err) {
      console.error("Google sign-in failed:", err);
      const code = err?.code || err?.message || "error";
      setError(`Google: ${code}`);
    }
  };

  const submitDisabled = !ageOk || loading;

  return (
    <div className="auth-page">
      <div className="auth-blob auth-blob-peach" />

      <div className="auth-topbar">
        <button className="auth-back" onClick={() => navigate("/")} aria-label="back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      <div className="auth-body">
        <h1 className="auth-title">{t("register_title")}</h1>
        <p className="auth-sub">{t("register_subtitle")}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span className="auth-field-label">Email</span>
            <input
              className="auth-input"
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className="auth-field">
            <span className="auth-field-label">{t("password")}</span>
            <div className="auth-input-wrap">
              <input
                className="auth-input"
                type={showPwd ? "text" : "password"}
                placeholder={t("password_min")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="button" className="auth-eye" onClick={() => setShowPwd(!showPwd)} aria-label="toggle">
                {showPwd ? "✕" : "👁"}
              </button>
            </div>
          </label>

          <button
            type="button"
            className={`auth-check${ageOk ? " checked" : ""}`}
            onClick={() => setAgeOk((v) => !v)}
          >
            <span className="auth-check-box">
              {ageOk && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0E1410" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5 9-12" />
                </svg>
              )}
            </span>
            <span className="auth-check-label">{t("confirm_age")}</span>
          </button>

          <button
            type="button"
            className={`auth-check${policyOk ? " checked" : ""}`}
            onClick={() => {
              if (policyOk) {
                setPolicyOk(false);
                gramixStorage.remove(POLICY_FLAG);
              } else {
                setShowPolicy(true);
              }
            }}
          >
            <span className="auth-check-box">
              {policyOk && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0E1410" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5 9-12" />
                </svg>
              )}
            </span>
            <span className="auth-check-label">
              {t("read_and_agree_prefix")}{" "}
              <span
                className="auth-check-link"
                onClick={(e) => { e.stopPropagation(); setShowPolicy(true); }}
              >
                {t("privacy_policy")}
              </span>
            </span>
          </button>

          {error && <p className="auth-error">{error}</p>}

          <button className="auth-submit" type="submit" disabled={submitDisabled}>
            {loading ? t("loading") : t("welcome_register")}
          </button>
        </form>

        <div className="auth-divider">
          <span className="auth-divider-line" />
          <span className="auth-divider-text">{t("or")}</span>
          <span className="auth-divider-line" />
        </div>

        <button className="auth-google" type="button" onClick={handleGoogle}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2.1 1.4-4.6 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.7 16.3 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2c-.4.4 6.6-4.8 6.6-14.9 0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          {t("welcome_continue_google")}
        </button>

        <div className="auth-toggle">
          {t("have_account")}{" "}
          <button type="button" className="auth-toggle-link" onClick={() => navigate("/login")}>
            {t("welcome_login")}
          </button>
        </div>
      </div>

      <PrivacyPolicyModal
        isOpen={showPolicy}
        onClose={() => setShowPolicy(false)}
        requireAgree
        onAgree={() => {
          setPolicyOk(true);
          gramixStorage.set(POLICY_FLAG, "1");
        }}
      />
    </div>
  );
}
