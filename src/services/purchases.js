// Subscription / billing service.
//
// Production wiring uses RevenueCat → Cloud Function `revenueCatWebhook` →
// Firestore. The client never writes the `premium` flag itself; the webhook
// is the source of truth (verified server-side by RevenueCat).
//
// Setup checklist:
// 1. Install plugin (one-time):
//      npm i @revenuecat/purchases-capacitor
//      npx cap sync android
//
// 2. RevenueCat dashboard:
//    - Project → API keys → copy the Android Public key into REVENUECAT_ANDROID_KEY.
//    - Connect Google Play Console (service account JSON).
//    - Subscriptions: Subscription Group → product `gramix_premium`, two Base
//      Plans `:monthly` (P1M, 200 UAH) and `:yearly` (P1Y, 1200 UAH).
//    - Entitlement `premium` attached to both base plans.
//    - Offering `default` with packages `$rc_monthly` and `$rc_annual`.
//    - Webhooks → URL = https://<region>-<project>.cloudfunctions.net/revenueCatWebhook
//      Authorization header: `Bearer <RC_WEBHOOK_SECRET>` (same secret in
//      mobile-app/functions/.env).
//
// 3. Google Play Console:
//    - In-app subscription product id: `gramix_premium`, base plans as above.
//    - License testers added to internal track.
//
// 4. Spanish IVA: Google Play handles consumer VAT collection. We declare net
//    payouts via Modelo 303/390 in Hacienda. Welcome email contains the seller
//    info required by Spanish invoicing rules — see backend templates.

import { auth } from "../pages/firebase-config";

const REVENUECAT_ANDROID_KEY =
  import.meta.env.VITE_REVENUECAT_ANDROID_KEY || ""; // public RC Android key

export const PLANS = {
  monthly: {
    key: "monthly",
    productId: "gramix_premium:monthly",
    priceUah: 200,
    periodMonths: 1,
  },
  yearly: {
    key: "yearly",
    productId: "gramix_premium:yearly",
    priceUah: 1200,
    periodMonths: 12,
  },
};

export const PREMIUM_LIMITS = { photoLimit: 10, editLimit: 10 };

let configured = false;

async function loadPurchases() {
  // Dynamic import so the bundle still builds before the plugin is installed.
  const mod = await import(
    /* @vite-ignore */ "@revenuecat/purchases-capacitor"
  );
  return mod.Purchases || mod.default;
}

// Call once after Firebase auth resolves: ties RC user to our Firebase uid so
// the webhook can map the event back to users/{uid}.
export async function initRevenueCat() {
  if (configured) return;
  const user = auth.currentUser;
  if (!user) return;
  if (!REVENUECAT_ANDROID_KEY || REVENUECAT_ANDROID_KEY === "REPLACE_ME") {
    console.warn("[purchases] RevenueCat key not set — purchases disabled");
    return;
  }
  try {
    const Purchases = await loadPurchases();
    await Purchases.configure({
      apiKey: REVENUECAT_ANDROID_KEY,
      appUserID: user.uid,
    });
    configured = true;
  } catch (e) {
    console.warn("[purchases] init failed (plugin missing?)", e);
  }
}

export async function startPurchase(planKey) {
  const plan = PLANS[planKey];
  const user = auth.currentUser;
  if (!plan) throw new Error("invalid plan");
  if (!user) throw new Error("not signed in");

  const Purchases = await loadPurchases();
  if (!configured) await initRevenueCat();

  const offerings = await Purchases.getOfferings();
  const pkg = (offerings?.current?.availablePackages || []).find(
    (p) => p?.product?.identifier === plan.productId,
  );
  if (!pkg) throw new Error("offering not found: " + plan.productId);

  const result = await Purchases.purchasePackage({ aPackage: pkg });
  const customerInfo = result?.customerInfo || result;
  const active = customerInfo?.entitlements?.active?.premium;
  if (!active) throw new Error("entitlement inactive");

  // Firestore is updated by the RC webhook → CF — we just return what RC
  // confirmed so the UI can show success without waiting for the round-trip.
  return {
    plan: plan.key,
    expiresAt: active.expirationDate
      ? new Date(active.expirationDate)
      : new Date(Date.now() + plan.periodMonths * 30 * 86400_000),
  };
}

export async function restorePurchases() {
  const Purchases = await loadPurchases();
  if (!configured) await initRevenueCat();
  const result = await Purchases.restorePurchases();
  const customerInfo = result?.customerInfo || result;
  const active = customerInfo?.entitlements?.active?.premium;
  return active
    ? {
        active: true,
        plan: active.productIdentifier?.includes("yearly") ? "yearly" : "monthly",
        expiresAt: active.expirationDate ? new Date(active.expirationDate) : null,
      }
    : null;
}

export async function loadEntitlement() {
  const Purchases = await loadPurchases();
  if (!configured) await initRevenueCat();
  const result = await Purchases.getCustomerInfo();
  const customerInfo = result?.customerInfo || result;
  const active = customerInfo?.entitlements?.active?.premium;
  if (!active) return null;
  return {
    active: true,
    plan: active.productIdentifier?.includes("yearly") ? "yearly" : "monthly",
    expiresAt: active.expirationDate ? new Date(active.expirationDate) : null,
  };
}
