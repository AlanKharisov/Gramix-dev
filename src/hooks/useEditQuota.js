import { useEffect, useRef, useState } from "react";
import { auth, db } from "../pages/firebase-config";
import { doc, getDoc, setDoc } from "../services/firestoreCompat";
import { Device } from "@capacitor/device";

const DEFAULT_LIMIT = 5;

function getTodayKey() {
  return new Date().toDateString();
}

async function getDeviceId() {
  try {
    const info = await Device.getId();
    return info.identifier;
  } catch {
    let id = localStorage.getItem("_cs_device_id");
    if (!id) {
      id = crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("_cs_device_id", id);
    }
    return id;
  }
}

const lsKey = (deviceId) => `_cs_edits_device_${deviceId || "anon"}`;

function readLocal(deviceId) {
  try {
    const raw = localStorage.getItem(lsKey(deviceId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocal(deviceId, data) {
  try {
    localStorage.setItem(lsKey(deviceId), JSON.stringify(data));
  } catch {
    /* storage full or disabled */
  }
}

export function useEditQuota() {
  const uidRef = useRef(auth.currentUser?.uid ?? null);
  const deviceIdRef = useRef(null);
  const countRef = useRef(0);
  const dateRef = useRef(getTodayKey());
  const limitRef = useRef(DEFAULT_LIMIT);
  const loadedRef = useRef(false);

  const [editLimit, setEditLimit] = useState(DEFAULT_LIMIT);
  const [editsLeft, setEditsLeft] = useState(DEFAULT_LIMIT);
  const [loaded, setLoaded] = useState(false);

  const refreshUi = () => {
    setEditLimit(limitRef.current);
    setEditsLeft(Math.max(0, limitRef.current - countRef.current));
  };

  const rollDay = () => {
    const today = getTodayKey();
    if (dateRef.current !== today) {
      dateRef.current = today;
      countRef.current = 0;
      if (deviceIdRef.current) {
        writeLocal(deviceIdRef.current, { date: today, count: 0 });
      }
      refreshUi();
    }
  };

  const loadQuota = async (user) => {
    const today = getTodayKey();
    dateRef.current = today;
    uidRef.current = user?.uid ?? null;

    if (!deviceIdRef.current) {
      deviceIdRef.current = await getDeviceId();
    }
    const deviceId = deviceIdRef.current;

    // Device-scoped count: persists across account switches on same phone
    const local = readLocal(deviceId);
    if (local && local.date === today) {
      countRef.current = Number(local.count) || 0;
    } else {
      countRef.current = 0;
      writeLocal(deviceId, { date: today, count: 0 });
    }

    // Per-user limit (defaults to 5)
    limitRef.current = DEFAULT_LIMIT;
    if (user?.uid) {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (data.editLimit && Number(data.editLimit) > 0) {
            limitRef.current = Number(data.editLimit);
          }
        }
      } catch {
        /* keep default */
      }
    }

    // Reconcile with device-scoped counter in Firestore
    try {
      const devRef = doc(db, "devices", deviceId);
      const devSnap = await getDoc(devRef);
      if (devSnap.exists()) {
        const data = devSnap.data();
        if (data.editsDate === today) {
          const remote = Number(data.editsCount) || 0;
          if (remote > countRef.current) {
            countRef.current = remote;
            writeLocal(deviceId, { date: today, count: countRef.current });
          }
        }
      }
    } catch {
      /* offline — fall back to localStorage */
    }

    loadedRef.current = true;
    setLoaded(true);
    refreshUi();
  };

  useEffect(() => {
    loadQuota(auth.currentUser);
    const unsub = auth.onAuthStateChanged((user) => {
      loadQuota(user);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canEdit = () => {
    rollDay();
    if (!loadedRef.current) return false;
    return countRef.current < limitRef.current;
  };

  const incrementEdit = async () => {
    const deviceId = deviceIdRef.current;
    if (!deviceId) return;
    rollDay();
    countRef.current += 1;
    const today = dateRef.current;
    writeLocal(deviceId, { date: today, count: countRef.current });
    refreshUi();
    try {
      await setDoc(
        doc(db, "devices", deviceId),
        { editsDate: today, editsCount: countRef.current },
        { merge: true },
      );
    } catch (e) {
      console.warn("editsCount sync failed, keeping local count", e);
    }
  };

  return { canEdit, incrementEdit, editsLeft, editLimit, loaded };
}
