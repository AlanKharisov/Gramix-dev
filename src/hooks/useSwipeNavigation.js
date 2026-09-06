import { useSwipeable } from 'react-swipeable';
import { useNavigate } from './useAppNavigate';

const PAGES = ['/main', '/stats'];

export function useSwipeNavigation(currentPath, isBlocked = false) {
  const navigate = useNavigate();
  const idx = PAGES.indexOf(currentPath);

  return useSwipeable({
    onSwipedLeft:  () => { if (!isBlocked && idx >= 0 && idx < PAGES.length - 1) navigate(PAGES[idx + 1], { state: { direction: 'left' } }); },
    onSwipedRight: () => { if (!isBlocked && idx > 0)                navigate(PAGES[idx - 1], { state: { direction: 'right' } }); },
    delta: 80,
    preventScrollOnSwipe: false,
    trackMouse: false,
  });
}
