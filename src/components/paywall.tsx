/**
 * Reusable paywall component.
 *
 * Feature-agnostic: any premium surface opens it with a short description and
 * the capability that triggered it. The component handles offering load,
 * package selection, purchase flow, restore, loading + error states, and
 * telemetry — callers only describe WHAT is being gated.
 *
 * On web the paywall explains that subscriptions are managed in the native
 * apps and offers a "Restore" no-op so the UX remains consistent.
 */
import { useEffect, useState } from "react";
import { Loader2, Check, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { subscriptionService } from "@/services/subscription";
import { PaymentsError, type SubscriptionPackage } from "@/platform/payments";
import { telemetry } from "@/platform/telemetry";
import { isNative } from "@/platform/runtime";
import type { Capability } from "@/config/subscription";

export interface PaywallProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Capability that triggered the paywall — used for telemetry. */
  capability?: Capability;
  /** Short, user-facing description of the locked feature. */
  featureTitle?: string;
  featureDescription?: string;
  /** Bullet list of benefits to highlight. */
  benefits?: string[];
  /** Called after a successful purchase / restore that unlocked entitlement. */
  onUnlocked?: () => void;
}

export function Paywall({
  open,
  onOpenChange,
  capability,
  featureTitle = "Unlock Pro",
  featureDescription = "Get full access to every Handoff Hero feature.",
  benefits = [
    "AI-powered SBAR summaries",
    "Unlimited templates and history",
    "Advanced alerts and reminders",
  ],
  onUnlocked,
}: PaywallProps) {
  const [packages, setPackages] = useState<SubscriptionPackage[] | null>(null);
  const [loadingOfferings, setLoadingOfferings] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    telemetry.info("subscription.paywall.shown", { capability: capability ?? "unspecified" });
    setError(null);
    if (!isNative()) {
      setPackages([]);
      return;
    }
    let cancelled = false;
    setLoadingOfferings(true);
    void subscriptionService
      .getOfferings()
      .then((pkgs) => {
        if (!cancelled) setPackages(pkgs);
      })
      .finally(() => {
        if (!cancelled) setLoadingOfferings(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, capability]);

  async function handlePurchase(pkg: SubscriptionPackage) {
    setError(null);
    setPurchasing(pkg.identifier);
    try {
      await subscriptionService.purchase(pkg.identifier);
      if (subscriptionService.hasProAccess()) {
        toast.success("Welcome to Pro!");
        onUnlocked?.();
        onOpenChange(false);
      } else {
        toast.message("Purchase received. Your access will activate shortly.");
      }
    } catch (err) {
      if (err instanceof PaymentsError && err.code === "cancelled") {
        // No error UI for user-cancelled purchases.
        return;
      }
      const msg = err instanceof Error ? err.message : "Purchase failed.";
      setError(msg);
    } finally {
      setPurchasing(null);
    }
  }

  async function handleRestore() {
    setError(null);
    setRestoring(true);
    try {
      await subscriptionService.restore();
      if (subscriptionService.hasProAccess()) {
        toast.success("Purchases restored.");
        onUnlocked?.();
        onOpenChange(false);
      } else {
        toast.message("No active subscription found on this account.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Restore failed.";
      setError(msg);
    } finally {
      setRestoring(false);
    }
  }

  const webOnly = !isNative();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <DialogTitle>{featureTitle}</DialogTitle>
          </div>
          <DialogDescription>{featureDescription}</DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 py-2">
          {benefits.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {webOnly ? (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Subscriptions are managed in the Handoff Hero iOS and Android apps. Install the app to
            subscribe, then sign in here to unlock Pro features.
          </div>
        ) : loadingOfferings ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : packages && packages.length > 0 ? (
          <div className="space-y-2">
            {packages.map((pkg) => (
              <button
                key={pkg.identifier}
                type="button"
                disabled={purchasing !== null}
                onClick={() => handlePurchase(pkg)}
                className="w-full rounded-lg border bg-card p-3 text-left transition hover:border-primary disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      {pkg.period === "annual"
                        ? "Annual"
                        : pkg.period === "monthly"
                          ? "Monthly"
                          : pkg.title}
                      {pkg.period === "annual" && <Badge variant="secondary">Best value</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{pkg.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{pkg.priceString}</div>
                    {purchasing === pkg.identifier && (
                      <Loader2 className="ml-auto h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Plans aren't available right now. Please check your connection and try again.
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"
          >
            {error}
          </div>
        )}

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="ghost" size="sm" disabled={restoring || webOnly} onClick={handleRestore}>
            {restoring ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
            Restore purchases
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
