import { useTranslation } from 'react-i18next';

export default function StepsToggle({ reading, busy, refresh }) {
  const { t } = useTranslation();
  const checked = Boolean(reading?.enabled && !['permission', 'unsupported', 'disabled'].includes(reading.status));
  const unavailable = reading?.status === 'unsupported';
  const toggle = () => refresh(checked ? 'disconnect' : reading?.healthAvailable ? 'connectHealth' : 'connectSensor');
  return <div className="profile-group gx-steps-toggle">
    <button type="button" className="profile-row profile-row--last" role="switch"
      aria-checked={checked} disabled={busy || !reading || unavailable} onClick={toggle}>
      <span className="profile-row-label">{t('x_steps')}</span>
      <span className="gx-switch-track" aria-hidden="true"><span /></span>
    </button>
    {(busy || ['permission', 'unsupported', 'error'].includes(reading?.status)) &&
      <p role="status">{t(busy ? 'x_stepsChecking' : 'x_steps_' + reading.status)}</p>}
  </div>;
}
