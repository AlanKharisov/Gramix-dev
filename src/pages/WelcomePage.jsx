import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { auth, db } from "./firebase-config";
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { doc, getDoc, setDoc, serverTimestamp } from "../services/firestoreCompat";
import PrivacyPolicyModal from "../components/PrivacyPolicyModal";
import { ensureAccount } from "../services/account";
import { gramixStorage, STORAGE_KEYS } from "../utils/storage";
import "./welcome.css";

const POLICY_FLAG = STORAGE_KEYS.POLICY_ACCEPTED;

const LANGUAGES = [
  { code: "en", flag: "🇬🇧", name: "English" },
  { code: "es", flag: "🇪🇸", name: "Español" },
  { code: "uk", flag: "🇺🇦", name: "Українська" },
  { code: "ru", flag: "🇷🇺", name: "Русский" },
  { code: "de", flag: "🇩🇪", name: "Deutsch" },
  { code: "ja", flag: "🇯🇵", name: "日本語" },
  { code: "zh", flag: "🇨🇳", name: "中文" },
  { code: "pl", flag: "🇵🇱", name: "Polski" },
];

export default function WelcomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [googleError, setGoogleError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [selectedLang, setSelectedLang] = useState(
    gramixStorage.get(STORAGE_KEYS.LANG) || i18n.language || "ru"
  );

  const requestGoogle = () => {
    setGoogleError("");
    if (gramixStorage.get(POLICY_FLAG) === "1") {
      doGoogle();
    } else {
      setShowPolicy(true);
    }
  };

  const handlePolicyAgree = () => {
    gramixStorage.set(POLICY_FLAG, "1");
    doGoogle();
  };

  const doGoogle = async () => {
    setBusy(true);
    setGoogleError("");
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
      setGoogleError(`Google: ${code}`);
    } finally {
      setBusy(false);
    }
  };

  const selectLang = (code) => {
    setSelectedLang(code);
    gramixStorage.set(STORAGE_KEYS.LANG, code);
    i18n.changeLanguage(code);
    setShowLangPicker(false);
  };

  const langDisplay = LANGUAGES.find((l) => l.code === selectedLang) || LANGUAGES[3];

  return (
    <div className="welcome-page">
      <div className="welcome-blob welcome-blob-mint" />
      <div className="welcome-blob welcome-blob-peach" />

      <div className="welcome-topbar">
        <button className="welcome-lang-pill" onClick={() => setShowLangPicker((s) => !s)}>
          <span>{langDisplay.flag}</span>
          <span>{langDisplay.name}</span>
        </button>
        {showLangPicker && (
          <div className="welcome-lang-menu">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                className={`welcome-lang-item${l.code === selectedLang ? " active" : ""}`}
                onClick={() => selectLang(l.code)}
              >
                <span>{l.flag}</span>
                <span>{l.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="welcome-hero">
        <div className="welcome-logo">
          <div className="welcome-logo-pulse" />
          <svg viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="17" r="11" stroke="#0E1410" strokeWidth="2.2" fill="none" />
            <circle cx="16" cy="17" r="6.5" stroke="#0E1410" strokeWidth="1.4" fill="none" opacity="0.5" />
            <path d="M22 8 C 18 6, 14 9, 14 13 C 17 13, 22 11, 22 8 Z" fill="#0E1410" />
            <path d="M14 13 L 19 9" stroke="#0E1410" strokeWidth="0.8" opacity="0.6" />
          </svg>
        </div>

        <div className="welcome-brand">
          <span className="welcome-brand-light"><span className="mechanical-g">G</span>ramix</span>
        </div>
        <p className="welcome-subtitle">{t("welcome_subtitle")}</p>
      </div>

      <div className="welcome-spacer" />

      <div className="welcome-actions">
        <button
          className="welcome-btn welcome-btn-primary"
          onClick={() => navigate("/register")}
          disabled={busy}
        >
          {t("welcome_register")}
        </button>

        <button
          className="welcome-btn welcome-btn-outline"
          onClick={() => navigate("/login")}
          disabled={busy}
        >
          {t("welcome_login")}
        </button>

        <button
          className="welcome-btn welcome-btn-google"
          onClick={requestGoogle}
          disabled={busy}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2.1 1.4-4.6 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.7 16.3 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2c-.4.4 6.6-4.8 6.6-14.9 0-1.3-.1-2.4-.4-3.5z" />
          </svg>
          {t("welcome_continue_google")}
        </button>

        {googleError && <p className="welcome-error">{googleError}</p>}
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
