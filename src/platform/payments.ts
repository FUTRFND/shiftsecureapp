/**
 * PlatformPayments — RevenueCat adapter.
 *
 * This file is the ONLY place in the codebase that imports the RevenueCat
 * SDK. The `PlatformPayments` interface is intentionally narrow and provider-
 * agnostic so the rest of the app (subscription service, paywall, gating)
 * can be ported to a different store-billing library without rewriting
 * screens.
 *
 * Web: returns "not entitled" and throws a clear error from purchase/restore
 * so the UI can route web users to install the native app instead.
 *
 * Native: dynamic-imports `@revenuecat/purchases-capacitor`. The package is
 * an optional native-only dependency; install it during the iOS/Android
 * build step. If it isn't installed yet, the adapter degrades to web
 * behaviour so the bundle still loads.
 */
import { getPlatform, isNative } from "./runtime";
import { getRevenueCatApiKey } from "@/config/subscription";

export interface SubscriptionPackage {
  /** RevenueCat package id (e.g. "$rc_monthly"). */
  identifier: string;
  /** Store product id. */
  productId: string;
  /** Localized price ("$9.99"). */
  priceString: string;
  /** Localized currency code ("USD"). */
  currencyCode: string;
  title: string;
  description: string;
  period: "monthly" | "annual" | "lifetime" | "unknown";
}

export interface CustomerInfo {
  /** RC app user id (matches Supabase user.id once logged in). */
  userId: string | null;
  /** Active entitlement identifiers. */
  activeEntitlements: string[];
  /** True if the subscription will auto-renew. */
  willRenew: boolean;
  /** Latest expiration of any active entitlement, ISO string. */
  expirationDate: string | null;
  /** True while a renewal payment is in a billing-retry / grace state. */
  inGracePeriod: boolean;
  /** True while the user is in account hold. */
  inAccountHold: boolean;
  /** Original purchase / first seen at, ISO string. */
  originalPurchaseDate: string | null;
}

export type CustomerInfoListener = (info: CustomerInfo) => void;

export interface PlatformPayments {
  /** Initialize the SDK and identify the user. Idempotent. */
  configure(opts: { userId: string | null }): Promise<void>;
  /** Switch the SDK to a new authenticated user. */
  login(userId: string): Promise<CustomerInfo>;
  /** Log out the SDK (reverts to an anonymous app user id). */
  logout(): Promise<CustomerInfo>;
  /** Fetch the current offering's available packages. */
  getOfferings(): Promise<SubscriptionPackage[]>;
  /** Purchase a package; resolves with updated customer info. */
  purchase(packageId: string): Promise<CustomerInfo>;
  /** Restore prior purchases (required by App Store guideline 3.1.1). */
  restore(): Promise<CustomerInfo>;
  /** Current entitlement / subscription snapshot from the SDK. */
  getCustomerInfo(): Promise<CustomerInfo>;
  /** Subscribe to live customer-info updates (renewals, expirations). */
  addCustomerInfoListener(cb: CustomerInfoListener): Promise<() => void>;
  /** True if the adapter can actually transact on this platform. */
  isAvailable(): boolean;
}

/**
 * Error subclass so callers can distinguish user cancellation from real
 * failures and surface friendly UI for each.
 */
export class PaymentsError extends Error {
  constructor(
    public readonly code:
      | "cancelled"
      | "pending"
      | "network"
      | "unsupported_platform"
      | "not_configured"
      | "package_not_found"
      | "store_problem"
      | "unknown",
    message: string,
  ) {
    super(message);
    this.name = "PaymentsError";
  }
}

// ---------- Web (no-op) ----------------------------------------------------

const webPayments: PlatformPayments = {
  async configure() {
    /* no-op */
  },
  async login() {
    return emptyInfo();
  },
  async logout() {
    return emptyInfo();
  },
  async getOfferings() {
    return [];
  },
  async purchase() {
    throw new PaymentsError(
      "unsupported_platform",
      "Subscriptions are managed inside the iOS or Android app.",
    );
  },
  async restore() {
    throw new PaymentsError(
      "unsupported_platform",
      "Restore is available inside the iOS or Android app.",
    );
  },
  async getCustomerInfo() {
    return emptyInfo();
  },
  async addCustomerInfoListener() {
    return () => {};
  },
  isAvailable() {
    return false;
  },
};

function emptyInfo(userId: string | null = null): CustomerInfo {
  return {
    userId,
    activeEntitlements: [],
    willRenew: false,
    expirationDate: null,
    inGracePeriod: false,
    inAccountHold: false,
    originalPurchaseDate: null,
  };
}

// ---------- Native (RevenueCat) -------------------------------------------

let nativeConfigured = false;
let nativeUnavailable = false; // true if dynamic import failed (plugin not installed)

type RcPurchasesModule = {
  Purchases: {
    configure: (opts: { apiKey: string; appUserID?: string | null }) => Promise<void>;
    logIn: (opts: { appUserID: string }) => Promise<{ customerInfo: unknown }>;
    logOut: () => Promise<{ customerInfo: unknown }>;
    getCustomerInfo: () => Promise<{ customerInfo: unknown }>;
    getOfferings: () => Promise<{ current?: { availablePackages?: unknown[] } | null }>;
    purchasePackage: (opts: { aPackage: unknown }) => Promise<{
      customerInfo: unknown;
      userCancelled?: boolean;
    }>;
    restorePurchases: () => Promise<{ customerInfo: unknown }>;
    addCustomerInfoUpdateListener: (cb: (info: unknown) => void) => Promise<{ remove: () => Promise<void> }>;
  };
  LOG_LEVEL?: Record<string, string>;
};

async function loadRc(): Promise<RcPurchasesModule | null> {
  if (nativeUnavailable) return null;
  if (!isNative()) {
    nativeUnavailable = true;
    return null;
  }
  try {
    // Defeat Vite/Rollup static analysis: the RevenueCat Capacitor SDK is a
    // native-only optional dependency and must NEVER be resolved by the web
    // build. We construct the module specifier at runtime and route through
    // a globally-injected dynamic importer that the native shell registers.
    const g = globalThis as { __lovableNativeImport?: (s: string) => Promise<unknown> };
    const importer = g.__lovableNativeImport;
    if (!importer) {
      nativeUnavailable = true;
      return null;
    }
    const spec = ["@revenuecat", "purchases-capacitor"].join("/");
    const mod = (await importer(spec)) as RcPurchasesModule;
    return mod;
  } catch (err) {
    console.warn("[payments] RevenueCat plugin unavailable", err);
    nativeUnavailable = true;
    return null;
  }
}

function normalizeInfo(raw: unknown): CustomerInfo {
  // The RC payload shape: { originalAppUserId, entitlements: { active: {...} }, ... }
  const info = (raw ?? {}) as {
    originalAppUserId?: string;
    entitlements?: {
      active?: Record<
        string,
        {
          identifier: string;
          willRenew?: boolean;
          expirationDate?: string | null;
          billingIssueDetectedAt?: string | null;
          originalPurchaseDate?: string | null;
        }
      >;
    };
  };
  const active = Object.values(info.entitlements?.active ?? {});
  const willRenew = active.some((e) => e.willRenew !== false);
  // Latest expiration across active entitlements.
  let expirationDate: string | null = null;
  for (const e of active) {
    if (!e.expirationDate) continue;
    if (!expirationDate || new Date(e.expirationDate) > new Date(expirationDate)) {
      expirationDate = e.expirationDate;
    }
  }
  const inGracePeriod = active.some((e) => Boolean(e.billingIssueDetectedAt));
  // Account hold: entitlement no longer active AND billing issue persisted —
  // RC surfaces this by removing it from `active`, so we treat any global
  // billing flag from the SDK as grace. True hold detection happens on the
  // backend via RC webhooks; the client treats it as "not entitled".
  const inAccountHold = false;
  const originalPurchaseDate = active[0]?.originalPurchaseDate ?? null;
  return {
    userId: info.originalAppUserId ?? null,
    activeEntitlements: active.map((e) => e.identifier),
    willRenew,
    expirationDate,
    inGracePeriod,
    inAccountHold,
    originalPurchaseDate,
  };
}

function normalizePackage(raw: unknown): SubscriptionPackage {
  const p = (raw ?? {}) as {
    identifier?: string;
    packageType?: string;
    product?: {
      identifier?: string;
      priceString?: string;
      currencyCode?: string;
      title?: string;
      description?: string;
    };
  };
  const id = (p.packageType ?? "").toLowerCase();
  const period: SubscriptionPackage["period"] =
    id.includes("annual") || id.includes("year")
      ? "annual"
      : id.includes("month")
        ? "monthly"
        : id.includes("lifetime")
          ? "lifetime"
          : "unknown";
  return {
    identifier: p.identifier ?? "",
    productId: p.product?.identifier ?? "",
    priceString: p.product?.priceString ?? "",
    currencyCode: p.product?.currencyCode ?? "",
    title: p.product?.title ?? "",
    description: p.product?.description ?? "",
    period,
  };
}

const nativePayments: PlatformPayments = {
  async configure({ userId }) {
    if (nativeConfigured) return;
    const apiKey = getRevenueCatApiKey();
    if (!apiKey) {
      console.warn("[payments] No RevenueCat API key for this platform.");
      nativeUnavailable = true;
      return;
    }
    const rc = await loadRc();
    if (!rc) return;
    await rc.Purchases.configure({ apiKey, appUserID: userId });
    nativeConfigured = true;
  },
  async login(userId) {
    const rc = await loadRc();
    if (!rc) throw new PaymentsError("not_configured", "Payments not available.");
    const { customerInfo } = await rc.Purchases.logIn({ appUserID: userId });
    return normalizeInfo(customerInfo);
  },
  async logout() {
    const rc = await loadRc();
    if (!rc) return emptyInfo();
    try {
      const { customerInfo } = await rc.Purchases.logOut();
      return normalizeInfo(customerInfo);
    } catch {
      return emptyInfo();
    }
  },
  async getOfferings() {
    const rc = await loadRc();
    if (!rc) return [];
    const { current } = await rc.Purchases.getOfferings();
    return (current?.availablePackages ?? []).map(normalizePackage);
  },
  async purchase(packageId) {
    const rc = await loadRc();
    if (!rc) throw new PaymentsError("not_configured", "Payments not available.");
    const offerings = await rc.Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages?.find(
      (p) => (p as { identifier?: string }).identifier === packageId,
    );
    if (!pkg) throw new PaymentsError("package_not_found", "Plan not available.");
    try {
      const res = await rc.Purchases.purchasePackage({ aPackage: pkg });
      if (res.userCancelled) throw new PaymentsError("cancelled", "Purchase cancelled.");
      return normalizeInfo(res.customerInfo);
    } catch (err) {
      if (err instanceof PaymentsError) throw err;
      const e = err as { code?: string | number; userCancelled?: boolean; message?: string };
      if (e?.userCancelled) throw new PaymentsError("cancelled", "Purchase cancelled.");
      // RC purchase error codes: numeric or string. Map common ones.
      const code = String(e?.code ?? "");
      if (code === "PURCHASE_CANCELLED" || code === "1")
        throw new PaymentsError("cancelled", "Purchase cancelled.");
      if (code === "PAYMENT_PENDING" || code === "PURCHASE_NOT_ALLOWED")
        throw new PaymentsError("pending", "Your purchase is pending approval.");
      if (code === "NETWORK_ERROR")
        throw new PaymentsError("network", "Network problem during purchase.");
      throw new PaymentsError("store_problem", e?.message ?? "The store rejected the purchase.");
    }
  },
  async restore() {
    const rc = await loadRc();
    if (!rc) throw new PaymentsError("not_configured", "Payments not available.");
    const { customerInfo } = await rc.Purchases.restorePurchases();
    return normalizeInfo(customerInfo);
  },
  async getCustomerInfo() {
    const rc = await loadRc();
    if (!rc) return emptyInfo();
    const { customerInfo } = await rc.Purchases.getCustomerInfo();
    return normalizeInfo(customerInfo);
  },
  async addCustomerInfoListener(cb) {
    const rc = await loadRc();
    if (!rc) return () => {};
    const handle = await rc.Purchases.addCustomerInfoUpdateListener((info) =>
      cb(normalizeInfo(info)),
    );
    return () => {
      void handle.remove();
    };
  },
  isAvailable() {
    return !nativeUnavailable && Boolean(getRevenueCatApiKey());
  },
};

export const platformPayments: PlatformPayments = isNative() ? nativePayments : webPayments;
