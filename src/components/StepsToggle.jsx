import { useTranslation } from 'react-i18next';

export default function StepsToggle({ reading, busy, refresh, automatic = false, canAuto = false }) {
  const { t } = useTranslation();
  const checked = Boolean(reading?.enabled && !['permission', 'unsupported', 'disabled'].includes(reading.status));
  const unavailable = reading?.status === 'unsupported';
  const toggle = () => refresh(checked ? 'disconnect' : reading?.healthAvailable ? 'connectHealth' : 'connectSensor');
  return <details className="profile-group gx-steps-toggle">
    <summary>{t(canAuto ? 'h_activityConnect' : 'x_steps')}</summary>
    <button type="button" className="profile-row profile-row--last" role="switch"
      aria-checked={checked} disabled={busy || !reading || unavailable} onClick={toggle}>
      <span className="profile-row-label">{t('x_steps')}</span>
      <span className="gx-switch-track" aria-hidden="true"><span /></span>
    </button>
    {(busy || ['permission', 'unsupported', 'error'].includes(reading?.status)) &&
      <p role="status">{t(busy ? 'x_stepsChecking' : 'x_steps_' + reading.status)}</p>}
    {canAuto && <p>{t('h_nativeSport')}</p>}
    {automatic && reading?.healthAvailable && <button type="button" disabled={busy} onClick={()=>refresh('connectHealth')}>{t('h_allowEnergy')}</button>}
    {canAuto && !automatic && <p>{t('h_selectAuto')}</p>}
    {automatic && checked && (!reading?.activeEnergyGranted || reading?.activeEnergyKcal == null) && <p role="status">{t('h_energyMissing')}</p>}
  </details>;
}
