/**
 * PlatformPayments — subscriptions abstraction.
 *
 * RevenueCat is wired in Phase 7 via `@revenuecat/purchases-capacitor`.
 * The interface lives here so screens (paywall, settings → restore) can be
 * built against a stable contract regardless of platform.
 *
 * Web: returns "not entitled" and a clear error from purchase() so paywalls
 *      can route users to download the native app instead.
 */
export interface SubscriptionPackage {
  identifier: string;          // RevenueCat package id (e.g. "$rc_monthly")
  productId: string;           // Store product id
  priceString: string;         // Localized price ("$9.99")
  title: string;
  description: string;
  period: "monthly" | "annual" | "lifetime" | "unknown";
}

export interface CustomerInfo {
  userId: string | null;
  activeEntitlements: string[];
  willRenew: boolean;
  expirationDate: string | null;
}

export interface PlatformPayments {
  /** Initialize the SDK with platform-specific API key + identify the user. */
  configure(opts: { userId: string | null }): Promise<void>;
  /** Fetch the current offering's available packages. */
  getOfferings(): Promise<SubscriptionPackage[]>;
  /** Purchase a package; resolves with updated customer info. */
  purchase(packageId: string): Promise<CustomerInfo>;
  /** Restore prior purchases (required by App Store review guideline 3.1.1). */
  restore(): Promise<CustomerInfo>;
  /** Current entitlement / subscription status. */
  getCustomerInfo(): Promise<CustomerInfo>;
  /** Convenience: is a given entitlement active right now? */
  hasEntitlement(id: string): Promise<boolean>;
}

const unsupported = (op: string): never => {
  throw new Error(`PlatformPayments.${op} is unavailable on web. Use the iOS or Android app to subscribe.`);
};

export const platformPayments: PlatformPayments = {
  async configure() {
    /* no-op on web; native impl wired in Phase 7 */
  },
  async getOfferings() {
    return [];
  },
  async purchase() {
    return unsupported("purchase");
  },
  async restore() {
    return unsupported("restore");
  },
  async getCustomerInfo() {
    return { userId: null, activeEntitlements: [], willRenew: false, expirationDate: null };
  },
  async hasEntitlement() {
    return false;
  },
};
