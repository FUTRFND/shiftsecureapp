/**
 * Platform abstraction layer.
 *
 * Every Capacitor / browser API the app touches is funneled through one of
 * these services so that:
 *   1. App code stays platform-agnostic.
 *   2. Web preview keeps working in the Lovable editor.
 *   3. Native plugins can be swapped without screen-level refactors.
 *
 * Native implementations dynamic-import their Capacitor plugin only when
 * `isNative()` is true, so the web bundle never pulls native code paths.
 */
export { isNative, isWeb, getPlatform } from "./runtime";
export {
  platformStorage,
  platformStorageSync,
  hydratePlatformStorageSync,
  type PlatformStorage,
} from "./storage";
export {
  platformSpeech,
  SpeechError,
  type PlatformSpeech,
  type SpeechResult,
  type SpeechErrorCode,
  type StartSpeechOptions,
} from "./speech";
export {
  platformPermissions,
  type PlatformPermissions,
  type PermissionName,
  type PermissionStatus,
} from "./permissions";
export { ClipboardError } from "./clipboard";
export { platformClipboard, type PlatformClipboard } from "./clipboard";
export { platformNetwork, type PlatformNetwork, type NetworkStatus } from "./network";
export { platformHaptics, type PlatformHaptics, type ImpactStyle } from "./haptics";
export { platformNotifications, type PlatformNotifications } from "./notifications";
export {
  platformPayments,
  type PlatformPayments,
  type SubscriptionPackage,
  type CustomerInfo,
} from "./payments";
export { platformCamera, type PlatformCamera, type CameraPhoto } from "./camera";
export { platformLocation, type PlatformLocation, type Coordinates } from "./location";
