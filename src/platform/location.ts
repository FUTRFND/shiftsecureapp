/**
 * PlatformLocation — geolocation (stub for Phase 6+).
 * Wire `@capacitor/geolocation` when a feature needs it.
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface PlatformLocation {
  requestPermission(): Promise<boolean>;
  getCurrentPosition(): Promise<Coordinates>;
}

export const platformLocation: PlatformLocation = {
  async requestPermission() {
    return false;
  },
  async getCurrentPosition() {
    throw new Error("Location not yet implemented; planned for a later phase.");
  },
};
