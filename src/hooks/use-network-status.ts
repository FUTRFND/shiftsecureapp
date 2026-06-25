/**
 * useNetworkStatus — React hook over PlatformNetwork.
 *
 * Returns the current connectivity + connection type and subscribes for
 * changes. Cleans up listener on unmount.
 */
import { useEffect, useState } from "react";
import { platformNetwork, type NetworkStatus } from "@/platform/network";

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    connected: true,
    connectionType: "unknown",
  });

  useEffect(() => {
    let active = true;
    let unsub: (() => void) | undefined;

    void platformNetwork.getStatus().then((s) => {
      if (active) setStatus(s);
    });
    void platformNetwork
      .addListener((s) => {
        if (active) setStatus(s);
      })
      .then((u) => {
        if (!active) u();
        else unsub = u;
      });

    return () => {
      active = false;
      unsub?.();
    };
  }, []);

  return status;
}
