import { auth } from '../pages/firebase-config';
import { isPersonalBudget } from '../services/personalBudget';
import { useSwipeable } from 'react-swipeable';
import { useNavigate } from './useAppNavigate';

const BASE_PAGES = ['/main', '/stats'];

export function useSwipeNavigation(currentPath, isBlocked = false) {
  const navigate = useNavigate();
  const PAGES = isPersonalBudget(auth.currentUser) ? [...BASE_PAGES, '/recommendations'] : BASE_PAGES;
  const idx = PAGES.indexOf(currentPath);

  return useSwipeable({
    onSwipedLeft:  () => { if (!isBlocked && idx >= 0 && idx < PAGES.length - 1) navigate(PAGES[idx + 1], { state: { direction: 'left' } }); },
    onSwipedRight: () => { if (!isBlocked && idx > 0)                navigate(PAGES[idx - 1], { state: { direction: 'right' } }); },
    delta: 80,
    preventScrollOnSwipe: false,
    trackMouse: false,
  });
}
