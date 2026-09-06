import { useEffect, useRef } from 'react';
import { auth } from '../pages/firebase-config';
import { isPersonalBudget } from '../services/personalBudget';

export function useHourlyBudget(refresh) {
  const latest = useRef(refresh);
  useEffect(() => { latest.current = refresh; }, [refresh]);
  useEffect(() => {
    let last = Date.now(), pending = false;
    const check = async () => {
      if (document.hidden || pending || !isPersonalBudget(auth.currentUser) || Date.now() - last < 3600000) return;
      pending = true; last = Date.now();
      try { await latest.current(); } finally { pending = false; }
    };
    const timer = setInterval(check, 60000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', check); window.removeEventListener('focus', check); };
  }, []);
}
