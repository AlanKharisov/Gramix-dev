import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n/index.js'   // initialise i18n before first render
import App from './App.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'
import { installTelemetry } from './services/telemetry'
import { installPhotoRestoration } from './services/photoCapture'

installTelemetry();
installPhotoRestoration();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </StrictMode>,
)
