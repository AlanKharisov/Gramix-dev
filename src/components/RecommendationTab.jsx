import { auth } from '../pages/firebase-config';
import { isPersonalBudget } from '../services/personalBudget';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useNavigate } from '../hooks/useAppNavigate';

export default function RecommendationTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const active = useLocation().pathname === '/recommendations';
  if (!isPersonalBudget(auth.currentUser)) return null;
  return <button className={`home-tab${active ? ' is-active' : ''}`} aria-label={t('tips_title')} aria-current={active ? 'page' : undefined} onClick={() => navigate('/recommendations', { state: { direction: 'left' } })}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2Z" /></svg>
    {active && <span>{t('nav_recommendations')}</span>}
  </button>;
}
