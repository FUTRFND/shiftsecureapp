/**
 * PlatformHaptics — tactile feedback (no-op on web).
 * Native: `@capacitor/haptics`.
 */
import { isNative } from "./runtime";

export type ImpactStyle = "light" | "medium" | "heavy";

export interface PlatformHaptics {
  impact(style?: ImpactStyle): Promise<void>;
  notificationSuccess(): Promise<void>;
  notificationError(): Promise<void>;
}

const webHaptics: PlatformHaptics = {
  async impact() {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      (navigator as Navigator & { vibrate: (p: number) => void }).vibrate(10);
    }
  },
  async notificationSuccess() {
    /* no-op */
  },
  async notificationError() {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      (navigator as Navigator & { vibrate: (p: number[]) => void }).vibrate([20, 40, 20]);
    }
  },
};

const nativeHaptics: PlatformHaptics = {
  async impact(style = "light") {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy } as const;
    await Haptics.impact({ style: map[style] });
  },
  async notificationSuccess() {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({ type: NotificationType.Success });
  },
  async notificationError() {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({ type: NotificationType.Error });
  },
};

export const platformHaptics: PlatformHaptics = isNative() ? nativeHaptics : webHaptics;
