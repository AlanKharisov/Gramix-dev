import { useTranslation } from 'react-i18next';
export default function StepsCard({ reading, busy, budget, refresh }) {
  const { t } = useTranslation();
  return <section className="gx-steps" aria-label={t('x_steps')}>
    <div className="gx-steps-top"><strong>{t('x_steps')}</strong>
      <span>{reading?.status === 'ready' ? budget.steps.toLocaleString() : '—'}</span></div>
    <p role="status">{busy ? t('x_stepsChecking') : reading?.status === 'ready'
      ? t(budget.eligible ? 'x_stepsEstimate' : 'x_stepsNoAdjustment', { kcal: budget.activeKcal, extra: budget.extra })
      : t('x_steps_' + (reading?.status || 'disabled'))}</p>
    {reading?.source && <small>{t('x_stepsSource_' + reading.source)}{reading.partial ? ' · ' + t('x_stepsPartial') : ''}</small>}
    <div className="gx-steps-actions">
      {reading?.status !== 'unsupported' && reading?.source !== 'health_connect' && reading?.healthAvailable &&
        <button disabled={busy} onClick={() => refresh('connectHealth')}>Health Connect</button>}
      {reading?.status !== 'ready' && reading?.sensorAvailable && (reading.status === 'disabled' || !reading.sensorGranted) &&
        <button disabled={busy} onClick={() => refresh('connectSensor')}>{t('x_stepsSensor')}</button>}
      {reading?.enabled && <>
        <button disabled={busy} onClick={() => refresh()}>{t('x_stepsRefresh')}</button>
        <button disabled={busy} onClick={() => refresh('disconnect')}>{t('x_stepsDisconnect')}</button>
      </>}
    </div>
    <small>{t('x_stepsPrivacy')}</small>
  </section>;
}
