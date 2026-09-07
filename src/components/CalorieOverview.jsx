import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import RingProgress from './RingProgress';
import AddMealSheet from './AddMealSheet';
import { useBackHandler } from '../hooks/useBackHandler';
import { auth } from '../pages/firebase-config';
import { isPersonalBudget } from '../services/personalBudget';

export default function CalorieOverview({ eaten, goal, base, extra, averages = [], today = true, personalAverage, showStatus = true, children, autoBudget = null }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const remaining = Math.round(goal - eaten);
  const over = !autoBudget && remaining < 0;
  const personal = isPersonalBudget(auth.currentUser);
  const status = t(over ? 'b_above' : today ? 'b_available' : 'x_periodRemaining');
  const amount = n => Math.round(n).toLocaleString(i18n.language);
  const signed = n => (Math.round(n)>0?'+':'')+amount(n);
  useBackHandler([{ when: () => open, do: () => setOpen(false) }]);
  return <div className={'gx-calorie-overview' + (over ? ' is-over' : '')}>
    <section className="home-rings-card">
    <RingProgress size={224} stroke={10} value={autoBudget ? autoBudget.resting : eaten} max={autoBudget ? Math.max(autoBudget.daily, autoBudget.resting) : goal}>
      <span className="gx-calorie-label">{autoBudget ? t('h_difference') : personal ? t('remaining') : t('calories')}</span>
      <strong className="gx-calorie-eaten">{amount(personal ? remaining : eaten)}</strong>
      <button className="gx-calorie-limit" onClick={() => setOpen(true)} aria-label={t('b_details')}>
        {t(autoBudget ? 'h_expense' : 'b_of', { n: amount(goal) })} <span aria-hidden="true">ⓘ</span>
      </button>
      {!personal && <><span className="gx-calorie-divider" />
      <span className="gx-calorie-label">{t(over ? 'b_above' : 'remaining')}</span>
      <strong className="gx-calorie-balance">{amount(Math.abs(remaining))}</strong></>}
    </RingProgress>
    {children}
    </section>
    {showStatus && <button className={'gx-budget-status' + (personal ? ' is-personal' : '')} onClick={() => setOpen(true)}>
      <span><span className="gx-budget-status-label">{personal ? t('h_average', { days: personalAverage?.days || 7 }) : status}</span>
        <strong>{personal ? personalAverage?.value == null ? '—' : signed(personalAverage.value) : amount(Math.abs(remaining))} <small>{t('kcal')}</small></strong>
        <span className="gx-budget-status-hint">{t('b_details')}</span></span>
      <span aria-hidden="true">›</span>
    </button>}
    {open && <AddMealSheet title={t('b_details')} onClose={() => setOpen(false)}>
      <div className="gx-budget-details">
        <dl>
          <div><dt>{t(autoBudget ? 'a_balance' : 'b_current')}</dt><dd>{amount(autoBudget ? remaining : goal)} {t('kcal')}</dd></div>
          <div><dt>{t(autoBudget ? 'a_rest' : 'x_baseBudget')}</dt><dd>{amount(base)} {t('kcal')}</dd></div>
          <div><dt>{t(autoBudget?'h_active':'x_stepBonus')}</dt><dd>+{amount(extra)} {t('kcal')}</dd></div>
          <div><dt>{t('x_recordedFood')}</dt><dd>{amount(eaten)} {t('kcal')}</dd></div>
          {autoBudget && <div><dt>{t('a_daily')}</dt><dd>{amount(autoBudget.daily)} {t('kcal')}</dd></div>}
        </dl>
        <p>{t(autoBudget ? 'a_formula' : 'b_formula')}</p>
        {autoBudget && !autoBudget.hasSteps && <p>{t('a_noSteps')}</p>}
        {autoBudget?.hasSteps && autoBudget.partial && <p>{t('x_stepsPartial')}</p>}
        {autoBudget?.importedAt && <p>{t('h_sync',{time:new Date(autoBudget.importedAt).toLocaleString(i18n.language)})}</p>}
        {(personal ? [personalAverage].filter(Boolean) : averages).map(average => <div className="gx-budget-average" key={average.days}>
          <span>{t(personal?'h_average':'x_averageDays', { days: average.days })}</span>
          <strong>{average.value === null ? '—' : personal?signed(average.value):amount(average.value)} {t('kcal')}</strong>
          <small>{t('x_diaryCoverage', { n: average.recordedDays, total: average.days })}</small>
        </div>)}
        <p>{t(personal?'h_averageHint':'b_history')}</p>
      </div>
      <button className="add-sheet-cancel" onClick={() => setOpen(false)}>{t('close')}</button>
    </AddMealSheet>}
  </div>;
}
