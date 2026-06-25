/**
 * PlatformNetwork — online/offline detection.
 * Web: `navigator.onLine` + `online`/`offline` events.
 * Native: `@capacitor/network` (true connection state, not just stack reachability).
 */
import { isNative } from "./runtime";

export type NetworkStatus = { connected: boolean; connectionType: string };

export interface PlatformNetwork {
  getStatus(): Promise<NetworkStatus>;
  addListener(cb: (status: NetworkStatus) => void): Promise<() => void>;
}

const webNetwork: PlatformNetwork = {
  async getStatus() {
    const connected = typeof navigator === "undefined" ? true : navigator.onLine;
    return { connected, connectionType: connected ? "unknown" : "none" };
  },
  async addListener(cb) {
    if (typeof window === "undefined") return () => {};
    const onOnline = () => cb({ connected: true, connectionType: "unknown" });
    const onOffline = () => cb({ connected: false, connectionType: "none" });
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  },
};

const nativeNetwork: PlatformNetwork = {
  async getStatus() {
    const { Network } = await import("@capacitor/network");
    const s = await Network.getStatus();
    return { connected: s.connected, connectionType: s.connectionType };
  },
  async addListener(cb) {
    const { Network } = await import("@capacitor/network");
    const handle = await Network.addListener("networkStatusChange", (s) =>
      cb({ connected: s.connected, connectionType: s.connectionType }),
    );
    return () => {
      void handle.remove();
    };
  },
};

export const platformNetwork: PlatformNetwork = isNative() ? nativeNetwork : webNetwork;
