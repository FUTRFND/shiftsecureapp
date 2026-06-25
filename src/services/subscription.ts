/**
 * SubscriptionService — application-facing subscription layer.
 *
 * Screens, gates, and business logic interact with THIS module — never with
 * `@/platform/payments` or RevenueCat directly. The contract here is
 * deliberately phrased in terms of *capabilities* (`hasProAccess`,
 * `can("ai.summarize")`) rather than entitlement identifiers, so the
 * underlying SKU layout can change without touching callers.
 *
 * Responsibilities:
 *   - initialization (idempotent boot, anonymous startup supported)
 *   - identity sync (login on Supabase sign-in, logout on sign-out)
 *   - product catalog
 *   - purchase + restore (delegated to the platform adapter)
 *   - entitlement lookup + capability resolution
 *   - caching (in-memory + persistent for offline launch)
 *   - listener fan-out (React hook subscribes to this, not the SDK)
 *   - operational telemetry
 *
 * Offline behaviour: the last verified entitlement snapshot is persisted via
 * `platformStorage`. On cold start we hydrate from cache first, then refresh
 * in the background; paying users keep access during a temporary outage.
 */
import {
  platformPayments,
  PaymentsError,
  type CustomerInfo,
  type SubscriptionPackage,
} from "@/platform/payments";
import { platformStorage } from "@/platform/storage";
import { telemetry } from "@/platform/telemetry";
import { isNative } from "@/platform/runtime";
import {
  CAPABILITY_ENTITLEMENTS,
  ENTITLEMENT_CACHE_KEY,
  ENTITLEMENT_CACHE_TTL_MS,
  ENTITLEMENT_IDS,
  type Capability,
} from "@/config/subscription";

export interface SubscriptionState {
  /** True once boot has hydrated cache + attempted a refresh. */
  ready: boolean;
  /** Most recent customer info (cached or live). */
  customerInfo: CustomerInfo;
  /** Active capabilities derived from `customerInfo`. */
  capabilities: Set<Capability>;
  /** True if the cached state is stale (offline / refresh failed). */
  stale: boolean;
  /** ISO timestamp of the last successful refresh. */
  lastRefreshedAt: string | null;
}

export interface SubscriptionListener {
  (state: SubscriptionState): void;
}

type PersistedSnapshot = {
  v: 1;
  customerInfo: CustomerInfo;
  refreshedAt: string;
};

const EMPTY_INFO: CustomerInfo = {
  userId: null,
  activeEntitlements: [],
  willRenew: false,
  expirationDate: null,
  inGracePeriod: false,
  inAccountHold: false,
  originalPurchaseDate: null,
};

class SubscriptionServiceImpl {
  private state: SubscriptionState = {
    ready: false,
    customerInfo: EMPTY_INFO,
    capabilities: new Set(),
    stale: true,
    lastRefreshedAt: null,
  };
  private listeners = new Set<SubscriptionListener>();
  private removeNativeListener?: () => void;
  private bootPromise?: Promise<void>;
  private currentUserId: string | null = null;

  // ---- Lifecycle --------------------------------------------------------

  /** Initialise the SDK and hydrate cached entitlements. Idempotent. */
  async init(userId: string | null = null): Promise<void> {
    if (this.bootPromise) return this.bootPromise;
    this.bootPromise = (async () => {
      this.currentUserId = userId;

      // 1. Hydrate offline snapshot synchronously into state — paying users
      //    must not be locked out during an offline cold start.
      const cached = await this.readCache();
      if (cached) {
        const stale =
          Date.now() - new Date(cached.refreshedAt).getTime() > ENTITLEMENT_CACHE_TTL_MS;
        this.update({
          customerInfo: cached.customerInfo,
          capabilities: deriveCapabilities(cached.customerInfo),
          lastRefreshedAt: cached.refreshedAt,
          stale,
        });
      }

      // 2. Configure the SDK. No-op on web.
      try {
        await platformPayments.configure({ userId });
      } catch (err) {
        console.warn("[subscription] configure failed", err);
      }

      // 3. Subscribe to live updates (renewals, billing failures).
      if (isNative() && platformPayments.isAvailable() && !this.removeNativeListener) {
        try {
          this.removeNativeListener = await platformPayments.addCustomerInfoListener((info) => {
            this.acceptLive(info, { source: "listener" });
          });
        } catch (err) {
          console.warn("[subscription] addCustomerInfoListener failed", err);
        }
      }

      // 4. Background refresh — never block the UI on this.
      void this.refresh().catch(() => {
        /* swallowed in refresh() */
      });

      this.update({ ready: true });
    })();
    return this.bootPromise;
  }

  /** Switch the SDK to a new Supabase user. */
  async login(userId: string): Promise<void> {
    this.currentUserId = userId;
    if (!platformPayments.isAvailable()) return;
    try {
      const info = await platformPayments.login(userId);
      this.acceptLive(info, { source: "login" });
      telemetry.info("subscription.identity.login", { hasEntitlement: this.hasProAccess() });
    } catch (err) {
      telemetry.warn("subscription.identity.login_failed", { error: errMessage(err) });
    }
  }

  /** Log the SDK out (anonymous user id). */
  async logout(): Promise<void> {
    this.currentUserId = null;
    if (platformPayments.isAvailable()) {
      try {
        const info = await platformPayments.logout();
        this.acceptLive(info, { source: "logout" });
      } catch (err) {
        telemetry.warn("subscription.identity.logout_failed", { error: errMessage(err) });
      }
    }
    // Wipe persisted entitlement so the next signed-out user doesn't inherit it.
    await this.clearCache();
    this.update({
      customerInfo: EMPTY_INFO,
      capabilities: new Set(),
      stale: false,
      lastRefreshedAt: null,
    });
    telemetry.info("subscription.identity.logout");
  }

  // ---- Catalog / purchases ---------------------------------------------

  async getOfferings(): Promise<SubscriptionPackage[]> {
    try {
      return await platformPayments.getOfferings();
    } catch (err) {
      telemetry.warn("subscription.offerings.failed", { error: errMessage(err) });
      return [];
    }
  }

  async purchase(packageId: string): Promise<SubscriptionState> {
    telemetry.info("subscription.purchase.started", { packageId });
    try {
      const info = await platformPayments.purchase(packageId);
      this.acceptLive(info, { source: "purchase" });
      telemetry.info("subscription.purchase.completed", {
        packageId,
        hasEntitlement: this.hasProAccess(),
      });
      return this.state;
    } catch (err) {
      if (err instanceof PaymentsError && err.code === "cancelled") {
        telemetry.info("subscription.purchase.cancelled", { packageId });
      } else if (err instanceof PaymentsError && err.code === "pending") {
        telemetry.info("subscription.purchase.pending", { packageId });
      } else {
        telemetry.warn("subscription.purchase.failed", {
          packageId,
          code: err instanceof PaymentsError ? err.code : "unknown",
        });
      }
      throw err;
    }
  }

  async restore(): Promise<SubscriptionState> {
    try {
      const info = await platformPayments.restore();
      this.acceptLive(info, { source: "restore" });
      telemetry.info("subscription.restore.completed", {
        hasEntitlement: this.hasProAccess(),
      });
      return this.state;
    } catch (err) {
      telemetry.warn("subscription.restore.failed", {
        code: err instanceof PaymentsError ? err.code : "unknown",
      });
      throw err;
    }
  }

  /** Force-refresh from the SDK. Safe to call repeatedly. */
  async refresh(): Promise<void> {
    if (!platformPayments.isAvailable()) {
      this.update({ ready: true });
      return;
    }
    try {
      const info = await platformPayments.getCustomerInfo();
      this.acceptLive(info, { source: "refresh" });
      telemetry.debug("subscription.refresh.ok", { hasEntitlement: this.hasProAccess() });
    } catch (err) {
      telemetry.warn("subscription.refresh.failed", { error: errMessage(err) });
      // Keep the cached snapshot — flag it stale so callers can show "offline".
      this.update({ stale: true });
    }
  }

  // ---- Capability API ---------------------------------------------------

  /** Generic capability check — preferred over entitlement-name checks. */
  can(capability: Capability): boolean {
    return this.state.capabilities.has(capability);
  }

  /** Convenience for the common pro-tier check. */
  hasProAccess(): boolean {
    return this.state.customerInfo.activeEntitlements.includes(ENTITLEMENT_IDS.pro);
  }

  hasFeature(capability: Capability): boolean {
    return this.can(capability);
  }

  canUseAI(): boolean {
    return this.can("ai.summarize");
  }

  canCreateUnlimitedTemplates(): boolean {
    return this.can("templates.unlimited");
  }

  // ---- State / listeners ------------------------------------------------

  getState(): SubscriptionState {
    return this.state;
  }

  subscribe(listener: SubscriptionListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ---- Internal ---------------------------------------------------------

  private acceptLive(info: CustomerInfo, { source }: { source: string }) {
    const capabilities = deriveCapabilities(info);
    const refreshedAt = new Date().toISOString();
    this.update({
      customerInfo: info,
      capabilities,
      lastRefreshedAt: refreshedAt,
      stale: false,
    });
    void this.writeCache({ v: 1, customerInfo: info, refreshedAt });
    telemetry.debug("subscription.state.changed", {
      source,
      active: info.activeEntitlements.length,
      willRenew: info.willRenew,
      grace: info.inGracePeriod,
    });
  }

  private update(patch: Partial<SubscriptionState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) {
      try {
        l(this.state);
      } catch (err) {
        console.warn("[subscription] listener threw", err);
      }
    }
  }

  private async readCache(): Promise<PersistedSnapshot | null> {
    try {
      const raw = await platformStorage.get(ENTITLEMENT_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PersistedSnapshot;
      if (parsed?.v !== 1) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private async writeCache(snap: PersistedSnapshot) {
    try {
      await platformStorage.set(ENTITLEMENT_CACHE_KEY, JSON.stringify(snap));
    } catch (err) {
      console.warn("[subscription] cache write failed", err);
    }
  }

  private async clearCache() {
    try {
      await platformStorage.remove(ENTITLEMENT_CACHE_KEY);
    } catch {
      /* ignore */
    }
  }
}

function deriveCapabilities(info: CustomerInfo): Set<Capability> {
  const out = new Set<Capability>();
  const active = new Set(info.activeEntitlements);
  for (const [cap, ents] of Object.entries(CAPABILITY_ENTITLEMENTS)) {
    if (ents.some((e) => active.has(e))) out.add(cap as Capability);
  }
  return out;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const subscriptionService = new SubscriptionServiceImpl();
