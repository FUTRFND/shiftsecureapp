/**
 * PlatformNotifications — local + push (stub for Phase 7+).
 * Wire `@capacitor/local-notifications` and `@capacitor/push-notifications`
 * when notification features are added; the interface lives here so callers
 * never branch on platform.
 */
export interface PlatformNotifications {
  requestPermission(): Promise<boolean>;
  schedule(opts: { id: number; title: string; body: string; at?: Date }): Promise<void>;
  cancel(id: number): Promise<void>;
}

export const platformNotifications: PlatformNotifications = {
  async requestPermission() {
    return false;
  },
  async schedule() {
    throw new Error("Notifications not yet implemented; planned for a later phase.");
  },
  async cancel() {
    /* no-op */
  },
};
