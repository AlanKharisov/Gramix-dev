import { useEffect, useMemo, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { auth } from '../pages/firebase-config';
import { stepsAvailable, readSteps, watchSteps, pauseSteps, loadStepHistory, saveStepDay } from '../services/steps';
import { localDay, stepBudget } from '../services/stepBudget';

export function useStepBudget(profile) {
  const [reading, setReading] = useState(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState(false);
  const budget = useMemo(() => stepBudget(profile, reading), [profile, reading]);
  const refreshRef = useRef(() => {});
  useEffect(() => {
    if (!stepsAvailable || !auth.currentUser) return;
    const uid = auth.currentUser.uid;
    let active = true, pending = false;
    const handles = [];
    loadStepHistory(uid).then(result => {
      if (active && auth.currentUser?.uid === uid) { setHistory(result.days || []); setHistoryError(false); }
    }).catch(() => { if (active) setHistoryError(true); });
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
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!stepsAvailable || !uid || !profile?.dailyNorm?.calories || reading?.status !== 'ready' || reading.date !== localDay()) return;
    let active = true;
    saveStepDay(uid, { ...reading, baseGoal: Number(profile.dailyNorm.calories), extra: budget.extra, activeKcal: budget.activeKcal })
      .then(result => { if (active && auth.currentUser?.uid === uid) { setHistory(result.days || []); setHistoryError(false); } })
      .catch(() => { if (active) setHistoryError(true); });
    return () => { active = false; };
  }, [reading, budget, profile]);
  const today = localDay();
  const currentHistory = useMemo(() => history.filter(day => day.date !== today || reading?.status === 'ready'), [history, reading?.status, today]);
  return { available: stepsAvailable, reading, busy, budget, history: currentHistory, historyError,
    refresh: method => refreshRef.current(method) };
}
