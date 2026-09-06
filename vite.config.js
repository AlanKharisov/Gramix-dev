import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { offlineBuild } from './scripts/offline-build.js'
 
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), offlineBuild()],
  build: {
    cssMinify: false,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'firebase/auth'],
  },
})
