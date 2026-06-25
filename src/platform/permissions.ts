/**
 * PlatformPermissions — centralized permission service.
 *
 * Every native permission funnels through one type so that:
 *   - Screens can call `platformPermissions.ensure("microphone")` without
 *     knowing which Capacitor plugin owns it.
 *   - Adding a new permission means adding one branch here; no screen edits.
 *   - Web returns sensible defaults (mic prompt happens at use time; camera
 *     and notifications use the Permissions API when present).
 */
import { isNative } from "./runtime";
import { platformSpeech } from "./speech";

export type PermissionName = "microphone" | "notifications" | "camera" | "location";
export type PermissionStatus = "granted" | "denied" | "prompt" | "unsupported";

export interface PlatformPermissions {
  check(name: PermissionName): Promise<PermissionStatus>;
  request(name: PermissionName): Promise<PermissionStatus>;
  /** Convenience: returns true when granted, false otherwise. Triggers a
   *  request if the current state is "prompt". */
  ensure(name: PermissionName): Promise<boolean>;
}

async function webCheck(name: PermissionName): Promise<PermissionStatus> {
  if (typeof navigator === "undefined") return "unsupported";
  const perms = (
    navigator as Navigator & {
      permissions?: { query: (p: { name: string }) => Promise<{ state: string }> };
    }
  ).permissions;
  if (!perms?.query) return "prompt";
  try {
    switch (name) {
      case "microphone":
        return (await perms.query({ name: "microphone" })).state as PermissionStatus;
      case "camera":
        return (await perms.query({ name: "camera" })).state as PermissionStatus;
      case "notifications":
        if (typeof Notification === "undefined") return "unsupported";
        return Notification.permission === "default"
          ? "prompt"
          : (Notification.permission as PermissionStatus);
      case "location":
        return (await perms.query({ name: "geolocation" })).state as PermissionStatus;
    }
  } catch {
    return "prompt";
  }
}

async function webRequest(name: PermissionName): Promise<PermissionStatus> {
  if (typeof navigator === "undefined") return "unsupported";
  switch (name) {
    case "microphone": {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        return "granted";
      } catch {
        return "denied";
      }
    }
    case "camera": {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
        return "granted";
      } catch {
        return "denied";
      }
    }
    case "notifications": {
      if (typeof Notification === "undefined") return "unsupported";
      const result = await Notification.requestPermission();
      return result === "default" ? "prompt" : (result as PermissionStatus);
    }
    case "location": {
      return new Promise((resolve) => {
        if (typeof navigator === "undefined" || !navigator.geolocation)
          return resolve("unsupported");
        navigator.geolocation.getCurrentPosition(
          () => resolve("granted"),
          (e) => resolve(e.code === 1 ? "denied" : "prompt"),
          { timeout: 8000 },
        );
      });
    }
  }
}

async function nativeCheck(name: PermissionName): Promise<PermissionStatus> {
  switch (name) {
    case "microphone": {
      const s = await platformSpeech.checkPermission();
      return s === "granted" ? "granted" : s === "denied" ? "denied" : "prompt";
    }
    case "camera":
    case "location":
    case "notifications":
      // Plugins not installed yet; added in later phases. Reported as
      // unsupported so callers render a "feature unavailable" CTA instead
      // of looping on a request.
      return "unsupported";
  }
}

async function nativeRequest(name: PermissionName): Promise<PermissionStatus> {
  switch (name) {
    case "microphone": {
      const ok = await platformSpeech.requestPermission();
      return ok ? "granted" : "denied";
    }
    case "camera":
    case "location":
    case "notifications":
      return "unsupported";
  }
}

export const platformPermissions: PlatformPermissions = {
  async check(name) {
    return isNative() ? nativeCheck(name) : webCheck(name);
  },
  async request(name) {
    return isNative() ? nativeRequest(name) : webRequest(name);
  },
  async ensure(name) {
    const current = await this.check(name);
    if (current === "granted") return true;
    if (current === "denied" || current === "unsupported") return false;
    const next = await this.request(name);
    return next === "granted";
  },
};
