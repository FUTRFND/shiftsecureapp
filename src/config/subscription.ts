/**
 * Subscription configuration.
 *
 * RevenueCat is the current implementation, but the rest of the app must
 * not know that. This file is the only place where RC API keys, product
 * identifiers, and entitlement identifiers live. Replacing RevenueCat later
 * only requires swapping the adapter in `src/platform/payments.ts` and the
 * REST helper in `supabase/functions/_shared/revenuecat.ts` — the capability
 * map, paywall, gating, and screens stay unchanged.
 */
import { getPlatform } from "@/platform/runtime";

// --- Capability map ---------------------------------------------------------
//
// Capabilities are the app's permission vocabulary. Business logic always
// asks "can the current user do X?", never "does this user have RC
// entitlement Y?". This indirection is what lets the underlying SKU layout
// (single Pro tier, multi-tier, feature add-ons) evolve without touching
// screens.

export const CAPABILITIES = [
  "ai.summarize",
  "templates.unlimited",
  "alerts.advanced",
  "history.unlimited",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** Each capability is unlocked by ANY of the listed entitlement ids. */
export const CAPABILITY_ENTITLEMENTS: Record<Capability, readonly string[]> = {
  "ai.summarize": ["pro"],
  "templates.unlimited": ["pro"],
  "alerts.advanced": ["pro"],
  "history.unlimited": ["pro"],
};

/** Entitlement identifiers configured in the RevenueCat dashboard. */
export const ENTITLEMENT_IDS = {
  pro: "pro",
} as const;

/** Store product / package identifiers. */
export const PRODUCT_IDS = {
  monthly: "handoffhero_pro_monthly",
  annual: "handoffhero_pro_annual",
} as const;

// --- API keys ---------------------------------------------------------------
//
// Public RevenueCat SDK keys are safe in the client bundle (they're
// platform-scoped and rate-limited by RC). They are surfaced as VITE_* env
// vars so they can differ per build environment without code changes.

const env = (typeof import.meta !== "undefined" ? import.meta.env : {}) as Record<
  string,
  string | undefined
>;

export const REVENUECAT_API_KEYS = {
  ios: env.VITE_REVENUECAT_IOS_KEY ?? "",
  android: env.VITE_REVENUECAT_ANDROID_KEY ?? "",
} as const;

export function getRevenueCatApiKey(): string {
  const p = getPlatform();
  if (p === "ios") return REVENUECAT_API_KEYS.ios;
  if (p === "android") return REVENUECAT_API_KEYS.android;
  return "";
}

/** How long a cached customer-info snapshot is considered fresh. */
export const ENTITLEMENT_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

/** Storage key for the offline entitlement snapshot. */
export const ENTITLEMENT_CACHE_KEY = "hh.subscription.cache.v1";
