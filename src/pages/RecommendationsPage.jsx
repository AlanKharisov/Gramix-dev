import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { auth, db } from './firebase-config';
import { isPersonalBudget } from '../services/personalBudget';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '../hooks/useAppNavigate';
import { useSwipeNavigation } from '../hooks/useSwipeNavigation';
import HubNavigation, { HubIcon } from '../components/HubNavigation';
import LoadError from '../components/LoadError';
import { getAccountId } from '../services/account';
import { collection, doc, getDoc, getDocs } from '../services/firestoreCompat';
import { foodSummary } from '../services/foodRecommendations';
import { getDishName } from '../services/categoryService';
import './recommendations.css';

export default function RecommendationsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const swipe = useSwipeNavigation('/recommendations');
  const allowed = isPersonalBudget(auth.currentUser);
  const [period, setPeriod] = useState('day');
  const [reduction, setReduction] = useState(10);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ loading: true, error: false, meals: [], profile: {} });
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setState(previous => ({ ...previous, loading: true, error: false }));
    (async () => {
      try {
        const accountId = await getAccountId();
        if (!accountId) throw new Error('authentication_required');
        const [profile, meals] = await Promise.all([getDoc(doc(db, 'users', accountId)), getDocs(collection(db, 'users', accountId, 'meals'))]);
        if (active) setState({ loading: false, error: false, profile: profile.exists() ? profile.data() : {}, meals: meals.docs.map(item => item.data()) });
      } catch { if (active) setState(previous => ({ ...previous, loading: false, error: true })); }
    })();
    return () => { active = false; };
  }, [allowed, attempt]);
  if (!allowed) return <Navigate to="/main" replace />;
  const summary = foodSummary(state.meals, period);
  const format = value => new Intl.NumberFormat(i18n.resolvedLanguage, { maximumFractionDigits: 0 }).format(value);
  const goal = Number(state.profile.dailyNorm?.calories);
  const excess = summary.totals.calories - goal;
  return <div className="main-page" {...swipe}>
    <div className="main-phone">
      <header className="main-header">
        <div className="main-header-text"><span className="red-part"><span className="mechanical-g">G</span>ramix</span></div>
        <button className="main-profile-btn" aria-label={t('update_profile')} onClick={() => navigate('/profile')}><HubIcon name="profile" /></button>
      </header>
      <main className="recommendations-page">
        <header className="recommendations-heading"><span className="recommendation-symbol"><HubIcon name="tips" size={28}/></span><h1>{t('tips_title')}</h1><p>{t('tips_intro')}</p></header>
        <div className="recommendations-period">{['day', 'week'].map(value => <button key={value} aria-pressed={period === value} onClick={() => setPeriod(value)}>{t(value === 'day' ? 'food_today' : 'food_week')}</button>)}</div>
        {state.loading ? <p role="status">{t('loading')}</p> : state.error ? <LoadError inline onRetry={() => setAttempt(value => value + 1)} /> : !summary.count ? <section className="recommendation-card"><p>{t('food_empty')}</p><button onClick={() => navigate('/manual-entry')}>{t('food_record')} <span aria-hidden="true">＋</span></button></section> : <>
          <section className="recommendation-card">
            <h2>{t('food_totals')}</h2><p>{t('food_coverage', { count: summary.count, recorded: summary.recordedDays, days: summary.days })}</p>
            <dl className="food-totals">{['calories', 'protein', 'fat', 'carbs'].map(key => <div key={key}><dt>{t(key)}</dt><dd>{format(summary.totals[key])} <small>{t(key === 'calories' ? 'kcal' : 'grams_unit')}</small></dd></div>)}</dl>
            {period === 'day' && (Number.isFinite(goal) && goal > 0 ? <div className="food-target"><strong>{t('food_target', { amount: format(goal) })}</strong><p>{t(excess > 0 ? 'food_over' : 'food_within', { amount: format(excess) })}</p></div> : <button onClick={() => navigate('/profile')}>{t('food_missing_target')}</button>)}
          </section>
          {summary.dishes.length > 0 && <section className="recommendation-card">
            <div className="recommendation-card-title"><HubIcon name="stats"/><h2>{t('food_sources')}</h2></div><p>{t('food_sources_help')}</p>
            <label className="food-reduction">{t('food_portion')}<select value={reduction} onChange={event => setReduction(Number(event.target.value))}>{[10, 20, 25].map(value => <option key={value} value={value}>{value}%</option>)}</select></label>
            <ol className="food-sources">{summary.dishes.map(item => <li key={item.name}>
              <div><strong>{getDishName(item.name, i18n.resolvedLanguage)}</strong><span>{format(item.calories)} {t('kcal')} · {format(item.calories / summary.totals.calories * 100)}%</span></div>
              <meter min="0" max={summary.totals.calories} value={item.calories} aria-label={getDishName(item.name, i18n.resolvedLanguage)} />
              <p>{t('food_saving', { amount: format(item.calories * reduction / 100) })}</p>
            </li>)}</ol>
          </section>}
          <p className="food-note">{t('food_note')}</p>
        </>}
        <button className="recommendations-refresh" disabled={state.loading} onClick={() => setAttempt(value => value + 1)}>{t('food_refresh')}</button>
      </main>
      <HubNavigation />
    </div>
  </div>;
}
