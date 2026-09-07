import { useTranslation } from 'react-i18next';
import { auth } from '../pages/firebase-config';
import { isPersonalBudget } from '../services/personalBudget';
import { restingEnergy } from '../services/accrualBudget';

export default function AccrualSettings({ profile, onChange }) {
  const { t, i18n } = useTranslation();
  if (!isPersonalBudget(auth.currentUser) || !profile) return null;
  const daily = restingEnergy(profile), enabled = profile.personalAccrualEnabled !== false;
  const toggle = () => onChange({ ...profile, personalAccrualEnabled: !enabled });
  return <div className="profile-group gx-steps-toggle">
    <button className="profile-row profile-row--last" type="button" role="switch" aria-checked={enabled}
      onClick={toggle}>
      <span className="profile-row-label">{t('a_auto')}</span>
      <span className="gx-switch-track" aria-hidden="true"><span /></span>
    </button>
    <p>{daily === null ? t('a_invalid') : t('a_rate', { daily: Math.round(daily).toLocaleString(i18n.language), hourly: Math.round(daily / 24) })}</p>
    <p>{t('a_hint')}</p>
    <p>{t('h_saveMode')}</p>
  </div>;
}
