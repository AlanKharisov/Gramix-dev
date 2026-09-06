import { useEffect, useState } from 'react';
import { auth } from '../pages/firebase-config';
import { accrualBudget } from '../services/accrualBudget';

export function useAccrualBudget(profile, reading) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => { if (!document.hidden) setNow(new Date()); };
    const timer = setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh); };
  }, []);
  return accrualBudget(auth.currentUser, profile, reading, now);
}
