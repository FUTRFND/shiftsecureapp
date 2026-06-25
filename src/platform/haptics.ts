/**
 * PlatformHaptics — tactile feedback.
 *
 * Use sparingly — only on meaningful events (recording start/stop, save
 * confirmation, AI completion, error). All web methods are best-effort
 * no-ops where the API is missing.
 */
import { isNative } from "./runtime";

export type ImpactStyle = "light" | "medium" | "heavy";

export interface PlatformHaptics {
  impact(style?: ImpactStyle): Promise<void>;
  notificationSuccess(): Promise<void>;
  notificationError(): Promise<void>;
}

function webVibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  try {
    nav.vibrate?.(pattern);
  } catch {
    /* ignored */
  }
}

const webHaptics: PlatformHaptics = {
  async impact(style = "light") {
    const map: Record<ImpactStyle, number> = { light: 10, medium: 20, heavy: 35 };
    webVibrate(map[style]);
  },
  async notificationSuccess() {
    webVibrate([10, 30, 10]);
  },
  async notificationError() {
    webVibrate([30, 60, 30]);
  },
};

const nativeHaptics: PlatformHaptics = {
  async impact(style = "light") {
    try {
      const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
      const map = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      } as const;
      await Haptics.impact({ style: map[style] });
    } catch {
      /* haptics are best-effort */
    }
  },
  async notificationSuccess() {
    try {
      const { Haptics, NotificationType } = await import("@capacitor/haptics");
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      /* noop */
    }
  },
  async notificationError() {
    try {
      const { Haptics, NotificationType } = await import("@capacitor/haptics");
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
      /* noop */
    }
  },
};

export const platformHaptics: PlatformHaptics = isNative() ? nativeHaptics : webHaptics;
