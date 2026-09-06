import { useState, useEffect, useRef } from 'react';
import { auth, db } from '../pages/firebase-config';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from '../services/firestoreCompat';
import { Device } from '@capacitor/device';
import { ensureAccount } from '../services/account';

const DEFAULT_LIMIT = 10;

function getTodayKey() {
  return new Date().toDateString();
}

async function getDeviceId() {
  try {
    const info = await Device.getId();
    return info.identifier;
  } catch {
    // Fallback for web/browser environments
    let id = localStorage.getItem('_cs_device_id');
    if (!id) {
      id = crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('_cs_device_id', id);
    }
    return id;
  }
}

export function useDailyQuota(enabled = true) {
  // Refs let canTakePhoto / incrementQuota read the absolute latest values
  // without stale-closure bugs, even when called synchronously right after
  // an increment (before the next React render).
  const uidRef      = useRef(auth.currentUser?.uid ?? null);
  const deviceIdRef = useRef(null);
  const countRef    = useRef(0);
  const limitRef    = useRef(DEFAULT_LIMIT);
  const loadedRef   = useRef(false); // stays false until first Firestore read finishes
  const dayRef = useRef(getTodayKey());

  // State drives re-renders so the consuming component stays in sync.
  const [userLimit, setUserLimit]     = useState(DEFAULT_LIMIT);
  const [quotaLoaded, setQuotaLoaded] = useState(false);

  // ─── load quota + user limit from Firestore ───────────────────────────────
  const loadQuota = async (user) => {
    if (!user) {
      uidRef.current    = null;
      countRef.current  = 0;
      limitRef.current  = DEFAULT_LIMIT;
      loadedRef.current = false;
      setUserLimit(DEFAULT_LIMIT);
      setQuotaLoaded(false);
      return;
    }

    uidRef.current = user.uid;
    const accountId = await ensureAccount(user);

    // Resolve device ID once per session
    if (!deviceIdRef.current) {
      deviceIdRef.current = await getDeviceId();
    }
    const deviceId = deviceIdRef.current;
    const today    = getTodayKey();

    const userRef   = accountId ? doc(db, 'users', accountId) : null;
    const deviceRef = doc(db, 'devices', deviceId);

    // Fetch both in parallel to minimise latency
    const [userSnap, deviceSnap] = await Promise.all([
      userRef ? getDoc(userRef) : Promise.resolve(null),
      getDoc(deviceRef),
    ]);
    if (auth.currentUser?.uid !== user.uid || uidRef.current !== user.uid) return;

    // ── User's plan limit (per account) ───────────────────────────────────
    const limit = (userSnap?.exists() && userSnap.data().photoLimit)
      ? userSnap.data().photoLimit
      : DEFAULT_LIMIT;

    limitRef.current = limit;
    setUserLimit(limit);

    // ── Shared device-level daily counter ─────────────────────────────────
    // This counter is shared across ALL accounts on the same physical device.
    // User A uses 5 photos → User B gets 0 on the same day.
    let count = 0;

    if (deviceSnap.exists()) {
      const data = deviceSnap.data();
      if (data.date === today) {
        count = data.count ?? 0;
      } else {
        // New calendar day – reset the counter
        await updateDoc(deviceRef, { count: 0, date: today });
      }
    } else {
      // First time this device is seen – create the document
      await setDoc(deviceRef, { count: 0, date: today });
    }

    // Track every Firebase UID that has logged in on this device — admin
    // panel uses this to spot account-stacking on a single phone.
    try {
      await setDoc(deviceRef, { uids: arrayUnion(user.uid) }, { merge: true });
    } catch (e) {
      console.warn('device.uids update failed', e);
    }

    countRef.current  = count;
    dayRef.current = today;
    loadedRef.current = true;
    setQuotaLoaded(true);
  };

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    // onAuthStateChanged fires immediately for the current session and again
    // on every login / logout / account switch.
    const unsubscribe = auth.onAuthStateChanged((user) => {
      // Close the gate immediately while fresh data loads for the new account.
      loadedRef.current = false;
      setQuotaLoaded(false);
      loadQuota(user).catch(() => {
        if (!active || auth.currentUser?.uid !== user?.uid) return;
        // The Worker remains authoritative; a failed auxiliary device read
        // must not masquerade as an exhausted allowance.
        countRef.current = 0;
        loadedRef.current = true;
        setQuotaLoaded(true);
      });
    });

    return () => { active = false; unsubscribe(); };
  }, [enabled]);

  // ─── public API ───────────────────────────────────────────────────────────

  /**
   * Returns false while the initial Firestore fetch is in flight.
   *
   * Once loaded:
   *   device count < user limit  →  true  (allowed)
   *   device count >= user limit →  false (blocked)
   *
   * The counter is device-scoped: switching accounts on the same phone
   * does NOT reset it. The limit reflects the currently logged-in user's plan.
   */
  const canTakePhoto = () => {
    if (dayRef.current !== getTodayKey()) { countRef.current = 0; dayRef.current = getTodayKey(); }
    if (!loadedRef.current) return false;
    return countRef.current < limitRef.current;
  };

  /**
   * Increments the shared device counter locally (instant UI) and in Firestore.
   * Should be called only after a successful backend response.
   */
  const incrementQuota = async () => {
    const deviceId = deviceIdRef.current;
    if (!deviceId) return;

    // Update synchronously so canTakePhoto() is correct before the round-trip.
    countRef.current += 1;

    try {
      const deviceRef = doc(db, 'devices', deviceId);
      await updateDoc(deviceRef, { count: countRef.current, date: getTodayKey() });
    } catch {
      // Network failure – roll back so the gate stays honest.
      countRef.current -= 1;
    }
  };

  return { canTakePhoto, incrementQuota, userLimit, quotaLoaded };
}
