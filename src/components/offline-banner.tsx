/**
 * OfflineBanner — slim notice rendered when the device is offline.
 * Reads the platform-aware network status (real connection state on native,
 * navigator.onLine on web) and stays out of the way when connected.
 */
import { WifiOff } from "lucide-react";
import { useNetworkStatus } from "@/hooks/use-network-status";

export function OfflineBanner({ message }: { message?: string }) {
  const { connected } = useNetworkStatus();
  if (connected) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>{message ?? "You're offline. Some features need a connection."}</span>
    </div>
  );
}
