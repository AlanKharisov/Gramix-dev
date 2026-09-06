import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n/index.js'   // initialise i18n before first render
import App from './App.jsx'
import './hub-scroll.css'
import './extras.css'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'
import { installTelemetry } from './services/telemetry'
import { installPhotoRestoration } from './services/photoCapture'
import { Capacitor } from '@capacitor/core'

if (import.meta.env.PROD && !Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {});
  }, { once: true });
}

installTelemetry();
installPhotoRestoration();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </StrictMode>,
)
