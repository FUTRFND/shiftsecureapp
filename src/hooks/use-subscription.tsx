/**
 * React bindings for the subscription service.
 *
 * Components import `useSubscription()` / `useCapability()` — never the
 * service singleton directly. This keeps state reads idiomatic and lets us
 * swap the underlying store later without touching consumers.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  subscriptionService,
  type SubscriptionState,
} from "@/services/subscription";
import type { Capability } from "@/config/subscription";

const SubscriptionContext = createContext<SubscriptionState | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SubscriptionState>(() => subscriptionService.getState());

  useEffect(() => {
    // Kick off boot once. Identity sync happens from AuthProvider via
    // subscriptionService.login/logout — we don't need the user here.
    void subscriptionService.init(null);
    const unsub = subscriptionService.subscribe(setState);
    return () => unsub();
  }, []);

  return <SubscriptionContext.Provider value={state}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionState & {
  can: (c: Capability) => boolean;
  hasProAccess: () => boolean;
  refresh: () => Promise<void>;
  restore: () => Promise<void>;
  purchase: (packageId: string) => Promise<void>;
} {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useSubscription must be used within SubscriptionProvider");
  return {
    ...ctx,
    can: (c) => ctx.capabilities.has(c),
    hasProAccess: () => subscriptionService.hasProAccess(),
    refresh: () => subscriptionService.refresh(),
    restore: async () => {
      await subscriptionService.restore();
    },
    purchase: async (pkg) => {
      await subscriptionService.purchase(pkg);
    },
  };
}

/** Lightweight hook for gating UI on a single capability. */
export function useCapability(capability: Capability): boolean {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useCapability must be used within SubscriptionProvider");
  return ctx.capabilities.has(capability);
}
