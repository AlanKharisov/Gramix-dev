import { Navigate } from 'react-router-dom';
import { auth } from './firebase-config';
import { isPersonalBudget } from '../services/personalBudget';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '../hooks/useAppNavigate';
import { useSwipeNavigation } from '../hooks/useSwipeNavigation';
import RecommendationTab from '../components/RecommendationTab';
import './recommendations.css';

const tips = [
  ['photo', 'tips_open_diary', '/main'],
  ['log', 'add_manually', '/manual-entry'],
  ['review', 'tips_open_stats', '/stats'],
  ['profile', 'tips_open_profile', '/profile'],
];
export default function RecommendationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const swipe = useSwipeNavigation('/recommendations');
  if (!isPersonalBudget(auth.currentUser)) return <Navigate to="/main" replace />;
  return <div className="main-page" {...swipe}>
    <main className="recommendations-page">
      <header><span className="recommendations-kicker">GRAMIX</span><h1>{t('tips_title')}</h1><p>{t('tips_intro')}</p></header>
      <div className="recommendations-grid">{tips.map(([key, action, route], index) => <article className="recommendation-card" key={key}>
        <span className="recommendation-number">0{index + 1}</span>
        <h2>{t(`tips_${key}_title`)}</h2><p>{t(`tips_${key}_body`)}</p>
        <button onClick={() => navigate(route)}>{t(action)} <span aria-hidden="true">↗</span></button>
      </article>)}</div>
    </main>
    <nav className="home-tabbar"><div className="home-tabbar-inner">
      <button className="home-tab" onClick={() => navigate('/main', { state: { direction: 'right' } })}>{t('nav_home')}</button>
      <button className="home-tab" onClick={() => navigate('/stats', { state: { direction: 'right' } })}>{t('nav_stats')}</button>
      <RecommendationTab />
    </div></nav>
  </div>;
}
