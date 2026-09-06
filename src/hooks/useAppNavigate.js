import { useCallback } from 'react';
import { useNavigate as useRouterNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { auth } from '../pages/firebase-config';

// Web tabs are surfaces of one app, not separate browser-history entries.
// Native Android keeps its existing system-back behavior.
export function useNavigate() {
  const navigate = useRouterNavigate();
  return useCallback((to, options) => {
    if (Capacitor.isNativePlatform()) return navigate(to, options);
    if (typeof to === 'number') return navigate(auth.currentUser ? '/main' : '/', { replace: true });
    return navigate(to, { ...options, replace: true });
  }, [navigate]);
}
