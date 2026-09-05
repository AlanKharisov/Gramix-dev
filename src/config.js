// Placeholder URLs — update these once the website is live
import packageInfo from '../package.json';
export const APP_RELEASE = import.meta.env.VITE_APP_RELEASE || packageInfo.version;
export const PRIVACY_POLICY_URL = "https://www.gramix.xyz";
export const PRODUCT_URL = "https://gramix.xyz";

// Backend base URL — set per build via .env.development / .env.production
export const API_BASE = import.meta.env.VITE_API_BASE;
