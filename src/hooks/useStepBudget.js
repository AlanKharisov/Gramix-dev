import { useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { auth } from '../pages/firebase-config';
import { stepsAvailable, readSteps, watchSteps, pauseSteps } from '../services/steps';
import { localDay, stepBudget } from '../services/stepBudget';

export function useStepBudget(profile) {
  const [reading, setReading] = useState(null);
  const [busy, setBusy] = useState(false);
  const refreshRef = useRef(() => {});
  useEffect(() => {
    if (!stepsAvailable || !auth.currentUser) return;
    const uid = auth.currentUser.uid;
    let active = true, pending = false;
    const handles = [];
    const refresh = async (method = 'getToday') => {
      if (!active || pending || auth.currentUser?.uid !== uid) return;
      pending = true; setBusy(true);
      setReading(old => old?.date === localDay() ? old : null);
      try {
        const next = await readSteps(uid, method);
        if (active && auth.currentUser?.uid === uid) setReading(next);
      } catch {
        if (active) setReading(old => ({ ...old, status: 'error' }));
      } finally { pending = false; if (active) setBusy(false); }
    };
    refreshRef.current = refresh;
    const retain = handle => { if (active) handles.push(handle); else handle.remove(); };
    watchSteps(next => {
      if (active && auth.currentUser?.uid === uid) setReading(old => old?.source === 'health_connect' && old.status === 'ready' ? old : next);
    }).then(retain).catch(() => {});
    App.addListener('appStateChange', state => { if (state.isActive) void refresh(); }).then(retain).catch(() => {});
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('focus', visible);
    // Refresh while open too, including local midnight and timezone changes.
    const timer = setInterval(visible, 60000);
    void refresh();
    return () => {
      active = false; refreshRef.current = () => {};
      handles.forEach(handle => handle.remove());
      document.removeEventListener('visibilitychange', visible);
      window.removeEventListener('focus', visible); clearInterval(timer);
      void pauseSteps(uid).catch(() => {});
    };
  }, []);
  return { available: stepsAvailable, reading, busy, budget: stepBudget(profile, reading),
    refresh: method => refreshRef.current(method) };
}
