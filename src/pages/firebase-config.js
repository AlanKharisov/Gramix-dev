import { initializeApp } from "firebase/app";
import { initializeAuth, indexedDBLocalPersistence, browserPopupRedirectResolver } from "firebase/auth";
import { Capacitor } from "@capacitor/core";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: indexedDBLocalPersistence,
  // Native Google login supplies a credential; web OAuth needs a popup resolver.
  ...(Capacitor.isNativePlatform() ? {} : { popupRedirectResolver: browserPopupRedirectResolver }),
});
// Kept as a lightweight path root for the Firestore-compatible API adapter.
// User data is stored in Cloudflare D1; Firebase is used only for Auth.
export const db = { __apiDb: true };
