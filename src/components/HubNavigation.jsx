import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '../hooks/useAppNavigate';
import { auth } from '../pages/firebase-config';
import { isPersonalBudget } from '../services/personalBudget';

export function HubIcon({ name, size = 22 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'home' ? <path d="m3 10 9-7 9 7v10H15v-7H9v7H3Z" /> : name === 'stats' ? <path d="M5 20V10M12 20V4M19 20v-7" /> : name === 'profile' ? <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></> : <path d="M9 18h6m-5 3h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 2H9s0-1-1-2Z" />}
  </svg>;
}
const tabs = [['/main', 'nav_home', 'home'], ['/stats', 'nav_stats', 'stats'], ['/recommendations', 'nav_recommendations', 'tips']];
export default function HubNavigation() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return <nav className="home-tabbar"><div className="home-tabbar-inner hub-navigation">
    {tabs.filter(([path]) => path !== '/recommendations' || isPersonalBudget(auth.currentUser)).map(([path, label, icon], index) => <button key={path} className={`home-tab${pathname === path ? ' is-active' : ''}`} aria-current={pathname === path ? 'page' : undefined} onClick={() => navigate(path, { state: { direction: index > tabs.findIndex(([p]) => p === pathname) ? 'left' : 'right' } })}>
      <HubIcon name={icon}/><span>{t(label)}</span>
    </button>)}
  </div></nav>;
}
