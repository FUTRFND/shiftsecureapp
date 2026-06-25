/**
 * <FeatureGate capability="ai.summarize"> — declarative gating wrapper.
 *
 * Renders children when the capability is unlocked; otherwise renders a
 * fallback (defaults to a button that opens the shared paywall). Screens
 * stay free of subscription branching — they describe what the feature is
 * and let this component decide whether to show it.
 */
import { useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCapability } from "@/hooks/use-subscription";
import { Paywall } from "@/components/paywall";
import type { Capability } from "@/config/subscription";

export interface FeatureGateProps {
  capability: Capability;
  /** Premium UI rendered when the capability is unlocked. */
  children: ReactNode;
  /** Custom fallback rendered when locked. Defaults to a "Upgrade" CTA. */
  fallback?: ReactNode;
  /** Short title and description shown in the default paywall. */
  featureTitle?: string;
  featureDescription?: string;
}

export function FeatureGate({
  capability,
  children,
  fallback,
  featureTitle,
  featureDescription,
}: FeatureGateProps) {
  const unlocked = useCapability(capability);
  const [open, setOpen] = useState(false);

  if (unlocked) return <>{children}</>;
  if (fallback) return <>{fallback}</>;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <Lock className="h-4 w-4" />
        Upgrade to unlock
      </Button>
      <Paywall
        open={open}
        onOpenChange={setOpen}
        capability={capability}
        featureTitle={featureTitle}
        featureDescription={featureDescription}
      />
    </>
  );
}
