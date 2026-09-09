import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import RingProgress from './RingProgress';
import AddMealSheet from './AddMealSheet';
import { useBackHandler } from '../hooks/useBackHandler';
import { auth } from '../pages/firebase-config';
import { isPersonalBudget } from '../services/personalBudget';

export default function CalorieOverview({ eaten, goal, base, extra, today = true, personalAverage, showStatus = true, children, autoBudget = null }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const remaining = Math.round(goal - eaten);
  const over = !autoBudget && remaining < 0;
  const personal = isPersonalBudget(auth.currentUser);
  const status = t(remaining < 0 ? 'h_aboveNow' : remaining > 0 ? 'h_leftNow' : 'h_atNow');
  const amount = n => Math.round(n).toLocaleString(i18n.language);
  useBackHandler([{ when: () => open, do: () => setOpen(false) }]);
  return <div className={'gx-calorie-overview' + (over ? ' is-over' : '')}>
    <section className="home-rings-card">
    <RingProgress size={224} stroke={10} value={eaten} max={goal}>
      <span className="gx-calorie-label">{t('h_eaten')}</span>
      <strong className="gx-calorie-eaten">{amount(eaten)} <small>{t('kcal')}</small></strong>
      <button className="gx-calorie-limit" onClick={() => setOpen(true)} aria-label={t(personal?'h_how':'b_details')}>
        {t('b_of', { n: amount(goal) })} <span aria-hidden="true">ⓘ</span>
      </button>
    <button type="button" className="gx-expenditure-average" onClick={()=>setOpen(true)}>
      <span>{t('h_averageShort')}</span>
      <strong>{personalAverage?.value == null ? '—' : amount(personalAverage.value)} <small>{t('kcal')}</small></strong>
    </button>
    </RingProgress>
    {children}
    </section>
    {showStatus && <button className={'gx-budget-status' + (personal ? ' is-personal' : '')} onClick={() => setOpen(true)}>
      <span><span className="gx-budget-status-label">{status}</span>
        <strong>{amount(Math.abs(remaining))} <small>{t('kcal')}</small></strong>
        <span className="gx-budget-status-hint">{t(autoBudget ? 'h_dynamicHint' : today ? 'h_dailyHint' : 'h_periodHint')}</span></span>
      <span aria-hidden="true">›</span>
    </button>}
    {open && <AddMealSheet title={t(personal?'h_how':'b_details')} onClose={() => setOpen(false)}>
      <div className="gx-budget-details">
        <dl>
          <div><dt>{t(autoBudget ? 'a_balance' : 'b_current')}</dt><dd>{amount(autoBudget ? remaining : goal)} {t('kcal')}</dd></div>
          <div><dt>{t(autoBudget ? 'a_rest' : 'x_baseBudget')}</dt><dd>{amount(base)} {t('kcal')}</dd></div>
          <div><dt>{t(autoBudget?'h_active':'x_stepBonus')}</dt><dd>+{amount(extra)} {t('kcal')}</dd></div>
          <div><dt>{t('x_recordedFood')}</dt><dd>{amount(eaten)} {t('kcal')}</dd></div>
          {autoBudget && <div><dt>{t('a_daily')}</dt><dd>{amount(autoBudget.daily)} {t('kcal')}</dd></div>}
        </dl>
        <p>{t(autoBudget ? 'h_formula' : 'b_formula')}</p>
        {autoBudget && !autoBudget.hasSteps && <p>{t('a_noSteps')}</p>}
        {autoBudget?.hasSteps && autoBudget.partial && <p>{t('x_stepsPartial')}</p>}
        {autoBudget?.importedAt && <p>{t('h_sync',{time:new Date(autoBudget.importedAt).toLocaleString(i18n.language)})}</p>}
        {autoBudget && <p>{t(autoBudget.activitySource === 'steps' ? 'h_walkingOnly' : autoBudget.activitySource === 'health' ? 'h_allActivity' : 'h_noActivity')}</p>}
        {[personalAverage].filter(Boolean).map(average => <div className="gx-budget-average" key={average.days}>
          <span>{t('h_average', { days: average.days })}</span>
          <strong>{average.value === null ? '—' : amount(average.value)} {t('kcal')}</strong>
          <small>{t('h_coverage', { n: average.recordedDays, total: average.days })}</small>
        </div>)}
        <p>{t('h_averageHint')}</p>
      </div>
      <button className="add-sheet-cancel" onClick={() => setOpen(false)}>{t('close')}</button>
    </AddMealSheet>}
  </div>;
}
