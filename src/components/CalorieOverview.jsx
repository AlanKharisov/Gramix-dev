import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import RingProgress from './RingProgress';
import AddMealSheet from './AddMealSheet';
import { useBackHandler } from '../hooks/useBackHandler';
import { auth } from '../pages/firebase-config';
import { isPersonalBudget } from '../services/personalBudget';

export default function CalorieOverview({ eaten, goal, base, extra, averages = [], today = true, personalAverage, showStatus = true, children }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const remaining = Math.round(goal - eaten);
  const over = remaining < 0;
  const personal = isPersonalBudget(auth.currentUser);
  const status = t(over ? 'b_above' : today ? 'b_available' : 'x_periodRemaining');
  const amount = n => Math.round(n).toLocaleString(i18n.language);
  useBackHandler([{ when: () => open, do: () => setOpen(false) }]);
  return <div className={'gx-calorie-overview' + (over ? ' is-over' : '')}>
    <section className="home-rings-card">
    <RingProgress size={224} stroke={10} value={eaten} max={goal}>
      <span className="gx-calorie-label">{personal ? t('remaining') : t('calories')}</span>
      <strong className="gx-calorie-eaten">{amount(personal ? remaining : eaten)}</strong>
      <button className="gx-calorie-limit" onClick={() => setOpen(true)} aria-label={t('b_details')}>
        {t('b_of', { n: amount(goal) })} <span aria-hidden="true">ⓘ</span>
      </button>
      {!personal && <><span className="gx-calorie-divider" />
      <span className="gx-calorie-label">{t(over ? 'b_above' : 'remaining')}</span>
      <strong className="gx-calorie-balance">{amount(Math.abs(remaining))}</strong></>}
    </RingProgress>
    {children}
    </section>
    {showStatus && <button className={'gx-budget-status' + (personal ? ' is-personal' : '')} onClick={() => setOpen(true)}>
      <span><span className="gx-budget-status-label">{personal ? t('x_averageDays', { days: personalAverage?.days || 7 }) : status}</span>
        <strong>{personal ? personalAverage?.value == null ? '—' : amount(personalAverage.value) : amount(Math.abs(remaining))} <small>{t('kcal')}</small></strong>
        <span className="gx-budget-status-hint">{t('b_details')}</span></span>
      <span aria-hidden="true">›</span>
    </button>}
    {open && <AddMealSheet title={t('b_details')} onClose={() => setOpen(false)}>
      <div className="gx-budget-details">
        <dl>
          <div><dt>{t('b_current')}</dt><dd>{amount(goal)} {t('kcal')}</dd></div>
          <div><dt>{t('x_baseBudget')}</dt><dd>{amount(base)} {t('kcal')}</dd></div>
          <div><dt>{t('x_stepBonus')}</dt><dd>+{amount(extra)} {t('kcal')}</dd></div>
          <div><dt>{t('x_recordedFood')}</dt><dd>{amount(eaten)} {t('kcal')}</dd></div>
        </dl>
        <p>{t('b_formula')}</p>
        {averages.map(average => <div className="gx-budget-average" key={average.days}>
          <span>{t('x_averageDays', { days: average.days })}</span>
          <strong>{average.value === null ? '—' : amount(average.value)} {t('kcal')}</strong>
          <small>{t('x_diaryCoverage', { n: average.recordedDays, total: average.days })}</small>
        </div>)}
        <p>{t('b_history')}</p>
      </div>
      <button className="add-sheet-cancel" onClick={() => setOpen(false)}>{t('close')}</button>
    </AddMealSheet>}
  </div>;
}
