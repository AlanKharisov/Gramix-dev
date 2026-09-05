import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { auth, db } from "./firebase-config";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from "firebase/auth";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { Capacitor } from "@capacitor/core";
import { doc, getDoc, setDoc, serverTimestamp } from "../services/firestoreCompat";
import { NativeBiometric, BiometryType } from "capacitor-native-biometric";
import { useVerifyModal } from "../contexts/VerifyModalContext";
import PrivacyPolicyModal from "../components/PrivacyPolicyModal";
import { ensureAccount } from "../services/account";
import { gramixStorage, STORAGE_KEYS } from "../utils/storage";
import "./auth-form.css";

const PENDING_VERIFIED_KEY = STORAGE_KEYS.VERIFIED_UID;
const POLICY_FLAG = STORAGE_KEYS.POLICY_ACCEPTED;

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { show: showVerifyModal } = useVerifyModal();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bioType, setBioType] = useState("fingerprint");
  const [bioAvailable, setBioAvailable] = useState(false);
  const [hasStoredCreds, setHasStoredCreds] = useState(false);
  const [resetState, setResetState] = useState(null); // null|"sending"|"sent"|"error"
  const [showPolicy, setShowPolicy] = useState(false);

  useEffect(() => {
    NativeBiometric.isAvailable()
      .then(async (result) => {
        setBioAvailable(!!result.isAvailable);
        if (
          result.biometryType === BiometryType.FACE_ID ||
          result.biometryType === BiometryType.FACE_AUTHENTICATION
        ) setBioType("face");
        try {
          const creds = await NativeBiometric.getCredentials({ server: "caloriesnap.app" });
          if (creds?.username) setHasStoredCreds(true);
        } catch { /* ignore */ }
      })
      .catch(() => {});
  }, []);

  const performLogin = async (lEmail, lPassword) => {
    if (!lEmail || !lPassword) return;
    setLoading(true);
    setError("");
    let cred;
    try {
      cred = await signInWithEmailAndPassword(auth, lEmail, lPassword);
    } catch (err) {
      console.error("[login] signIn failed:", err);
      const code = err?.code || err?.message || "unknown";
      setError(`${t("login_error")}: ${code}`);
      setLoading(false);
      return;
    }

    try { localStorage.setItem("cs_recent_pwd", lPassword); } catch { /* ignore */ }
    try {
      await NativeBiometric.setCredentials({
        username: lEmail, password: lPassword, server: "caloriesnap.app",
      });
    } catch { /* not fatal */ }

    let accountId = null;
    try {
      accountId = await ensureAccount(cred.user);
    } catch (err) {
      console.error("[login] ensureAccount failed:", err);
    }

    if (accountId) {
      const pendingUid = gramixStorage.get(PENDING_VERIFIED_KEY);
      if (pendingUid === cred.user.uid) {
        try {
          await setDoc(doc(db, "users", accountId), { emailVerified: true }, { merge: true });
          gramixStorage.remove(PENDING_VERIFIED_KEY);
        } catch (e) { console.warn("[login] verify-flag write failed:", e); }
      }
    }

    let data = {};
    let docExists = false;
    try {
      const snap = accountId ? await getDoc(doc(db, "users", accountId)) : null;
      if (snap?.exists()) {
        docExists = true;
        data = snap.data();
      }
    } catch (err) {
      console.error("[login] user-doc read failed:", err);
    }

    setLoading(false);

    // Even if user-doc read failed, the auth itself succeeded — let App.jsx's
    // onAuthStateChanged drive the next screen. Falling back to /biometric
    // keeps the user moving forward instead of stuck on /login.
    if (!docExists) {
      navigate("/biometric");
      return;
    }
    const isGoogleUser = cred.user.providerData.some(
      (provider) => provider.providerId === "google.com",
    );
    const emailVerified = isGoogleUser || cred.user.emailVerified || data.emailVerified !== false;
    if (!emailVerified) {
      showVerifyModal(lEmail, cred.user.uid);
    } else {
      if (data.emailVerified !== true && accountId) {
        setDoc(doc(db, "users", accountId), { emailVerified: true }, { merge: true })
          .catch(() => {});
      }
      navigate(data.profileCompleted ? "/main" : "/biometric");
    }
  };

  const handleBiometric = async () => {
    if (!hasStoredCreds) {
      // First-time login: nothing to unlock yet — guide the user.
      setError(t("login_error"));
      return;
    }
    try {
      await NativeBiometric.verifyIdentity({
        reason: t("welcome_login_email"),
        title: t("welcome_login_email"),
        subtitle: bioType === "face" ? t("face_id_prompt") : t("touch_id_prompt"),
      });
      const creds = await NativeBiometric.getCredentials({ server: "caloriesnap.app" });
      if (creds) {
        setEmail(creds.username);
        setPassword(creds.password);
        await performLogin(creds.username, creds.password);
      }
    } catch { /* user cancel */ }
  };

  const requestGoogle = () => {
    setError("");
    if (gramixStorage.get(POLICY_FLAG) === "1") {
      handleGoogle();
    } else {
      setShowPolicy(true);
    }
  };

  const handlePolicyAgree = () => {
    gramixStorage.set(POLICY_FLAG, "1");
    handleGoogle();
  };

  const handleGoogle = async () => {
    setError("");
    let firebaseUser;
    try {
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
    } catch (err) {
      console.error("[google-login] auth failed:", err);
      const code = err?.code || err?.message || "error";
      setError(`Google auth: ${code}`);
      return;
    }

    let accountId = null;
    try {
      accountId = await ensureAccount(firebaseUser);
    } catch (err) {
      console.error("[google-login] ensureAccount failed:", err);
    }

    if (!accountId) {
      // Auth ok but publicId resolution failed — let App.jsx handle from here.
      navigate("/biometric");
      return;
    }

    try {
      const ref = doc(db, "users", accountId);
      const snap = await getDoc(ref);
      if (!snap.exists() || !snap.data()?.email) {
        const lang = gramixStorage.get(STORAGE_KEYS.LANG) || "ru";
        await setDoc(ref, {
          email: firebaseUser.email,
          language: lang,
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
      console.error("[google-login] firestore failed:", err);
      const code = err?.code || err?.message || "error";
      setError(`Google firestore: ${code}`);
    }
  };

  const handleForgot = async () => {
    if (!email) {
      setError(t("forgot_need_email"));
      return;
    }
    setResetState("sending");
    setError("");
    try {
      await sendPasswordResetEmail(auth, email);
      setResetState("sent");
    } catch {
      setResetState("error");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-blob auth-blob-mint" />

      <div className="auth-topbar">
        <button className="auth-back" onClick={() => navigate("/")} aria-label="back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      <div className="auth-body">
        <h1 className="auth-title">{t("login_title")}</h1>
        <p className="auth-sub">{t("login_subtitle")}</p>

        <form
          className="auth-form"
          onSubmit={(e) => { e.preventDefault(); performLogin(email, password); }}
        >
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
                placeholder={t("password_placeholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button type="button" className="auth-eye" onClick={() => setShowPwd(!showPwd)} aria-label="toggle">
                {showPwd ? "✕" : "👁"}
              </button>
            </div>
          </label>

          <div className="auth-forgot-row">
            {resetState === "sent" ? (
              <span className="auth-forgot-ok">{t("reset_sent")}</span>
            ) : resetState === "error" ? (
              <span className="auth-forgot-err">{t("reset_failed")}</span>
            ) : (
              <button
                type="button"
                className="auth-link"
                onClick={handleForgot}
                disabled={resetState === "sending"}
              >
                {resetState === "sending" ? t("sending") : t("forgot_password")}
              </button>
            )}
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? t("loading") : t("welcome_login")}
          </button>
        </form>

        {bioAvailable && (
          <div className="auth-bio">
            <button
              className={`auth-bio-btn${hasStoredCreds ? "" : " is-disabled"}`}
              type="button"
              onClick={handleBiometric}
            >
              <span className="auth-bio-pulse" />
              <span className="auth-bio-pulse auth-bio-pulse-2" />
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 11v3a4 4 0 0 1-4 4" />
                <path d="M16 18a6 6 0 0 0 .8-3v-2a4 4 0 0 0-4-4H10" />
                <path d="M5.6 16a8 8 0 0 0 .9-7.6" />
                <path d="M3 10a9 9 0 0 1 18 0v3" />
                <path d="M12 7a4 4 0 0 1 4 4v3a8 8 0 0 1-.4 2.5" />
                <path d="M8 21l1-3" />
              </svg>
            </button>
            <div className="auth-bio-label">
              {bioType === "face" ? t("login_face_id") : t("login_touch_id")}
            </div>
          </div>
        )}

        <div className="auth-divider">
          <span className="auth-divider-line" />
          <span className="auth-divider-text">{t("or")}</span>
          <span className="auth-divider-line" />
        </div>

        <button className="auth-google" type="button" onClick={requestGoogle}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2.1 1.4-4.6 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.7 16.3 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2c-.4.4 6.6-4.8 6.6-14.9 0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          {t("welcome_continue_google")}
        </button>

        <div className="auth-toggle">
          {t("no_account")}{" "}
          <button type="button" className="auth-toggle-link" onClick={() => navigate("/register")}>
            {t("welcome_register")}
          </button>
        </div>
      </div>

      <PrivacyPolicyModal
        isOpen={showPolicy}
        onClose={() => setShowPolicy(false)}
        requireAgree
        onAgree={handlePolicyAgree}
      />
    </div>
  );
}
