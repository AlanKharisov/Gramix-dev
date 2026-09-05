import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { auth } from "./firebase-config";
import { NativeBiometric, BiometryType } from "capacitor-native-biometric";
import "./biometric-setup.css";

export default function BiometricSetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [bioType, setBioType] = useState("fingerprint");
  const [available, setAvailable] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    NativeBiometric.isAvailable()
      .then((res) => {
        setAvailable(!!res.isAvailable);
        if (res.biometryType === BiometryType.FACE_ID || res.biometryType === BiometryType.FACE_AUTHENTICATION) {
          setBioType("face");
        }
      })
      .catch(() => setAvailable(false));
  }, []);

  const skip = () => {
    try { localStorage.removeItem("cs_recent_pwd"); } catch { /* ignore */ }
    navigate("/body-bio", { replace: true });
  };

  const enroll = async () => {
    if (!available) return skip();
    setError("");
    setWorking(true);
    try {
      await NativeBiometric.verifyIdentity({
        reason: t("biometric_setup_reason"),
        title: t("biometric_setup_title"),
        subtitle: bioType === "face" ? t("face_id_prompt") : t("touch_id_prompt"),
      });
      const user = auth.currentUser;
      const email = user?.email;
      const pwd = localStorage.getItem("cs_recent_pwd") || "";
      if (email && pwd) {
        try {
          await NativeBiometric.setCredentials({
            username: email,
            password: pwd,
            server: "caloriesnap.app",
          });
        } catch { /* not fatal */ }
      }
      // Don't leave the password sitting in localStorage after enrollment.
      try { localStorage.removeItem("cs_recent_pwd"); } catch { /* ignore */ }
      navigate("/body-bio", { replace: true });
    } catch {
      setError(t("biometric_cancelled"));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="bio-setup-page">
      <div className="bio-setup-glow" />

      <div className="bio-setup-body">
        <div className="bio-setup-icon">
          <span className="bio-setup-pulse" />
          <span className="bio-setup-pulse bio-setup-pulse-2" />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 11v3a4 4 0 0 1-4 4" />
            <path d="M16 18a6 6 0 0 0 .8-3v-2a4 4 0 0 0-4-4H10" />
            <path d="M5.6 16a8 8 0 0 0 .9-7.6" />
            <path d="M3 10a9 9 0 0 1 18 0v3" />
            <path d="M12 7a4 4 0 0 1 4 4v3a8 8 0 0 1-.4 2.5" />
            <path d="M8 21l1-3" />
          </svg>
        </div>

        <h1 className="bio-setup-title">
          {bioType === "face"
            ? t("biometric_setup_title_face")
            : t("biometric_setup_title_touch")}
        </h1>
        <p className="bio-setup-sub">{t("biometric_setup_desc")}</p>

        {error && <p className="bio-setup-error">{error}</p>}
      </div>

      <div className="bio-setup-actions">
        <button className="bio-setup-primary" onClick={enroll} disabled={working}>
          {working ? t("loading") : (bioType === "face" ? t("enable_face_id") : t("enable_touch_id"))}
        </button>
        <button className="bio-setup-skip" onClick={skip} disabled={working}>
          {t("skip")}
        </button>
      </div>
    </div>
  );
}
