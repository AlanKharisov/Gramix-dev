import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auth, db } from '../pages/firebase-config';
import { isPersonalBudget } from '../services/personalBudget';
import { restingEnergy } from '../services/accrualBudget';
import { doc, setDoc } from '../services/firestoreCompat';
import { getAccountId } from '../services/account';

export default function AccrualSettings({ profile, onChange, native }) {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  if (!isPersonalBudget(auth.currentUser) || !profile) return null;
  const daily = restingEnergy(profile), enabled = profile.personalAccrualEnabled !== false;
  const toggle = async () => {
    setBusy(true); setError(false);
    try {
      const next = !enabled;
      await setDoc(doc(db, 'users', await getAccountId()), { personalAccrualEnabled: next }, { merge: true });
      onChange({ ...profile, personalAccrualEnabled: next });
    } catch { setError(true); } finally { setBusy(false); }
  };
  return <div className="profile-group gx-steps-toggle">
    <button className="profile-row profile-row--last" type="button" role="switch" aria-checked={enabled}
      disabled={busy} onClick={toggle}>
      <span className="profile-row-label">{t('a_auto')}</span>
      <span className="gx-switch-track" aria-hidden="true"><span /></span>
    </button>
    <p>{daily === null ? t('a_invalid') : t('a_rate', { daily: Math.round(daily).toLocaleString(i18n.language), hourly: Math.round(daily / 24) })}</p>
    <p>{t('a_hint')}</p>
    {!native && <p>{t('a_web')}</p>}
    {error && <p role="alert">{t('error')}</p>}
  </div>;
}
