import React, { Activity, useEffect, useRef, useState, lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useNavigate } from './hooks/useAppNavigate';
import { doc, getDoc, setDoc } from "./services/firestoreCompat";
import { auth, db } from "./pages/firebase-config";
import i18n from "./i18n/index.js";
import { useTranslation } from "react-i18next";

import VerifyEmailModal from "./components/VerifyEmailModal";
import BlockedModal from "./components/BlockedModal";
import { VerifyModalContext } from "./contexts/VerifyModalContext";
import { ensureAccount, clearAccountCache } from "./services/account";
import { touchLastActive } from "./services/userMetrics";
import { gramixStorage, STORAGE_KEYS } from "./utils/storage";
import LoadError from './components/LoadError';
import { reportIncident } from './services/telemetry';
// import { initRevenueCat } from "./services/purchases";

// Auth/onboarding pages stay lazy — they're cold-load only and not part of
// the hub the user navigates between after login.
const WelcomePage = lazy(() => import("./pages/WelcomePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const BiometricPage = lazy(() => import("./pages/BiometricPage"));
const BiometricSetupPage = lazy(() => import("./pages/BiometricSetupPage"));

// Hub triplet eager-loaded so swipes/taps between them never hit the chunk
// downloader. Adds ~70 kB gzipped to the initial bundle, eliminates the
// 3-5 s "Gramix..." flash users were hitting between hub pages.
import MainPage from "./pages/MainPage";
import StatsPage from "./pages/StatsPage";
import ProfilePage from "./pages/ProfilePage";
import ManualEntryPage from "./pages/ManualEntryPage";

import RecommendationsPage from "./pages/RecommendationsPage";

const HUB_PAGES = { '/main': MainPage, '/stats': StatsPage, '/recommendations': RecommendationsPage, '/profile': ProfilePage };
function HubPages() {
  const location = useLocation();
  const [visited, setVisited] = useState([]);
  const current = HUB_PAGES[location.pathname] ? location.pathname : null;
  if (current && !visited.includes(current)) setVisited([...visited, current]);
  const pages = current && !visited.includes(current) ? [...visited, current] : visited;
  return pages.map(path => {
    const Page = HUB_PAGES[path];
    const direction = location.state?.direction;
    const animation = direction === 'left' ? 'slide-in-right' : direction === 'right' ? 'slide-in-left' : '';
    return <Activity key={path} mode={current === path ? 'visible' : 'hidden'}>
      <div className={current === path ? animation : ''}><Page /></div>
    </Activity>;
  });
}

function PageLoader() {
  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      height: "100vh", 
      background: "#0E1410",
      color: "#8C9690"
    }}>
      <div className="loading-spinner" style={{
        width: 40, height: 40,
        border: "3px solid #1F2823",
        borderTopColor: "#0E9B8E",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite"
      }} />
    </div>
  );
}

const PENDING_KEY = STORAGE_KEYS.VERIFIED_UID;
const LAST_ROUTE_KEY = STORAGE_KEYS.LAST_ROUTE;

async function applyVerifiedFlag(uid) {
  // Deep-link cold launches arrive before Firebase Auth has restored the
  // persisted session, so currentUser is null for the first second or two.
  // Wait up to 5 s for it to settle on the matching uid before giving up.
  let current = auth.currentUser;
  let waited = 0;
  while ((!current || current.uid !== uid) && waited < 5000) {
    await new Promise((r) => setTimeout(r, 100));
    current = auth.currentUser;
    waited += 100;
  }
  if (!current || current.uid !== uid) return false;
  try {
    const accountId = await ensureAccount(current);
    if (!accountId) return false;
    await setDoc(doc(db, "users", accountId), { emailVerified: true }, { merge: true });
    gramixStorage.remove(PENDING_KEY);
    return true;
  } catch {
    return false;
  }
}

function AppRoutes() {
  const { t } = useTranslation();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [sessionUid, setSessionUid] = useState(null);
  const [authError, setAuthError] = useState(false);
  const [authAttempt, setAuthAttempt] = useState(0);
  const [verifyResult, setVerifyResult] = useState(null); // { ok: bool }
  const [verifyModal, setVerifyModal] = useState({ show: false, email: "", uid: "", initialError: false });
  const [blockedModal, setBlockedModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const routeRestoredRef = useRef(false);

  const showVerifyModal = (email, uid, initialError = false) =>
    setVerifyModal({ show: true, email: email || "", uid: uid || "", initialError });
  const hideVerifyModal = () => setVerifyModal({ show: false, email: "", uid: "", initialError: false });

  const handleVerificationSuccess = async (uid) => {
    gramixStorage.set(PENDING_KEY, uid);
    const applied = await applyVerifiedFlag(uid);
    hideVerifyModal();
    setVerifyResult({ ok: true });
    if (applied) {
      try {
        const current = auth.currentUser;
        const accountId = current?.uid === uid ? await ensureAccount(current) : null;
        const snap = accountId ? await getDoc(doc(db, "users", accountId)) : null;
        const data = snap?.exists() ? snap.data() : null;
        const completed = data?.profileCompleted === true;
        navigate(completed ? "/main" : "/biometric", { replace: true });
      } catch {
        navigate("/biometric", { replace: true });
      }
    }
  };

  // Android system back button: dispatch appBack event so the active page can
  // close its topmost modal. If nothing consumes it — hub-aware fallback:
  // /main and / exit the app (root); /stats and /profile go back to /main with
  // replace (no history pile-up); everything else does navigate(-1).
  useEffect(() => {
    let cancelled = false;
    let handle;
    (async () => {
      try {
        const mod = await import("@capacitor/app");
        if (cancelled) return;
        handle = await mod.App.addListener("backButton", () => {
          const evt = new CustomEvent("appBack", { cancelable: true });
          const notHandled = window.dispatchEvent(evt);
          if (!notHandled) return;
          const path = window.location.pathname;
          if (path === "/main" || path === "/") {
            mod.App.exitApp();
          } else if (path === "/stats" || path === "/profile") {
            navigate("/main", { replace: true });
          } else {
            navigate(-1);
          }
        });
      } catch {
        // Web/dev has no native runtime — skip.
      }
    })();
    return () => {
      cancelled = true;
      try { handle?.remove?.(); } catch { /* ignore */ }
    };
  }, [navigate]);

  useEffect(() => {
    let generation = 0;
    const unsub = auth.onAuthStateChanged(async (user) => {
      const started = Date.now();
      const run = ++generation;
      setSessionUid(user?.uid || null);
      if (user) {
        // An offline launch may still restore Firebase's local identity.
        // Expose only the device draft, never infer account authorization.
        if (!navigator.onLine) {
          setAuthError(true);
          setIsCheckingAuth(false);
          return;
        }
        let profileCompleted = false;
        let emailVerified = false;
        let blocked = false;
        let docOk = false;
        try {
          const accountId = await ensureAccount(user);
          const pendingUid = gramixStorage.get(PENDING_KEY);
          if (pendingUid === user.uid) {
            await applyVerifiedFlag(user.uid);
          }

          const snap = accountId ? await getDoc(doc(db, "users", accountId)) : null;
          if (snap?.exists()) {
            const userData = snap.data();
            docOk = true;
            profileCompleted = userData.profileCompleted === true;
            // Google accounts are verified by the provider. Preserve the
            // status of legacy Gramix accounts, while new email accounts
            // (explicit false) wait for Firebase's verification link.
            const isGoogleUser = user.providerData.some(
              (provider) => provider.providerId === "google.com",
            );
            emailVerified = isGoogleUser || user.emailVerified || userData.emailVerified !== false;
            blocked = userData.blocked === true;

            if (emailVerified && userData.emailVerified !== true) {
              setDoc(doc(db, "users", accountId), { emailVerified: true }, { merge: true })
                .catch(() => {});
            }

            if (!blocked && emailVerified) touchLastActive();

            const lang = userData.language;
            if (lang) {
              gramixStorage.set(STORAGE_KEYS.LANG, lang);
              i18n.changeLanguage(lang);
            }
          }
        } catch (err) {
          console.error("[auth] user-doc read failed:", err);
          if (run === generation) setAuthError(true);
        }

        if (run !== generation || auth.currentUser?.uid !== user.uid) return;

        if (!docOk) {
          // Doc not yet written (mid-registration) or read failed — let the
          // current page (RegisterPage / VerifyEmailModal) handle the next
          // step. Never auto-promote to /main on missing/error reads.
          setIsCheckingAuth(false);
          return;
        }
        setAuthError(false);
        if (Date.now() - started > 8000) reportIncident('startup_slow', null, { durationMs: Date.now() - started });

        if (blocked) {
          hideVerifyModal();
          setBlockedModal(true);
          try { await auth.signOut(); } catch { /* ignore */ }
          navigate("/", { replace: true });
        } else if (!emailVerified) {
          showVerifyModal(user.email || "", user.uid);
        } else {
          hideVerifyModal();
          const path = window.location.pathname;
          if (!profileCompleted) {
            if (path !== "/biometric" && path !== "/body-bio") navigate("/biometric", { replace: true });
          } else if (path === "/" || path === "/login" || path === "/register") {
            navigate("/main", { replace: true });
          }
        }
      } else {
        hideVerifyModal();
        gramixStorage.remove(LAST_ROUTE_KEY);
        routeRestoredRef.current = false;
        clearAccountCache();
      }
      setIsCheckingAuth(false);
    });
    return () => { generation++; unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authAttempt]);

  // App launch defaults to /main — last-route restoration intentionally disabled.

  // Pages serves directory entry points as /main/. Router matches that URL,
  // but the persistent hub uses exact keys. Canonicalize before rendering.
  const canonicalPath = location.pathname.replace(/\/+$/, '') || '/';
  if (canonicalPath !== location.pathname) {
    return <Navigate to={{ pathname: canonicalPath, search: location.search, hash: location.hash }} state={location.state} replace />;
  }

  if (isCheckingAuth) {
    return <div className="page loading-screen"><h2><span className="mechanical-g">G</span>ramix...</h2></div>;
  }
  if (authError && sessionUid && location.pathname === '/manual-entry') return <ManualEntryPage key={sessionUid} offlineOnly />;
  if (authError) return <div className="page loading-screen">
    <LoadError inline onRetry={() => { setAuthError(false); setIsCheckingAuth(true); setAuthAttempt(value => value + 1); }} />
    {sessionUid && <button className="gx-primary" style={{ width: 'auto' }} onClick={() => navigate('/manual-entry')}>{t('add_manually')}</button>}
  </div>;

  const direction = location.state?.direction;
  const animClass = direction === 'left' ? 'slide-in-right' : direction === 'right' ? 'slide-in-left' : '';

  return (
    <VerifyModalContext.Provider value={{ show: showVerifyModal, hide: hideVerifyModal }}>
      <div className={`page-anim-wrapper${!HUB_PAGES[location.pathname] && animClass ? ' ' + animClass : ''}`}>
        {sessionUid && <HubPages key={sessionUid} />}
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"          element={<WelcomePage />} />
            <Route path="/login"     element={<LoginPage />} />
            <Route path="/register"  element={<RegisterPage />} />
            <Route path="/biometric"  element={<BiometricSetupPage />} />
          <Route path="/body-bio"   element={<BiometricPage />} />
          {/* <Route path="/onboarding" element={<OnboardingPage />} /> */}
          <Route path="/main"      element={sessionUid ? null : <Navigate to="/" replace />} />
          <Route path="/stats"     element={sessionUid ? null : <Navigate to="/" replace />} />
          <Route path="/recommendations" element={sessionUid ? null : <Navigate to="/" replace />} />
          <Route path="/history"   element={<Navigate to="/stats" replace />} />
          <Route path="/profile"      element={sessionUid ? null : <Navigate to="/" replace />} />
          <Route path="/manual-entry" element={sessionUid ? <ManualEntryPage key={sessionUid} /> : <Navigate to="/" replace />} />
          {/* <Route path="/subscription" element={<SubscriptionPage />} /> */}
          <Route path="*" element={<Navigate to={sessionUid ? "/main" : "/"} replace />} />
          </Routes>
        </Suspense>

        <VerifyEmailModal
          isOpen={verifyModal.show}
          email={verifyModal.email}
          uid={verifyModal.uid}
          initialError={verifyModal.initialError}
          onVerified={() => handleVerificationSuccess(verifyModal.uid)}
          onBack={hideVerifyModal}
        />

        <BlockedModal
          isOpen={blockedModal}
          onClose={() => setBlockedModal(false)}
        />

        {verifyResult && (
          <div
            onClick={() => setVerifyResult(null)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 9000, padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#1c1c1e", padding: "32px 24px", borderRadius: 16,
                maxWidth: 340, textAlign: "center", color: "#fff",
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>
                {verifyResult.ok ? "✓" : "✕"}
              </div>
              <h3 style={{ margin: "0 0 8px 0" }}>
                {verifyResult.ok ? t("email_verified") : t("verification_failed")}
              </h3>
              <p style={{ color: "#bbb", fontSize: 14, margin: "0 0 20px 0" }}>
                {verifyResult.ok ? t("email_verified_desc") : t("verification_failed_desc")}
              </p>
              <button
                onClick={() => setVerifyResult(null)}
                style={{
                  background: "var(--brand-mint)", color: "var(--bg-base)", border: "none",
                  padding: "10px 24px", borderRadius: 12, fontSize: 15, fontWeight: 700,
                }}
              >
                {t("ok")}
              </button>
            </div>
          </div>
        )}
      </div>
    </VerifyModalContext.Provider>
  );
}

function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;
