/**
 * PlatformClipboard — copy / paste abstraction.
 * Web: `navigator.clipboard` with `document.execCommand` fallback for
 *      legacy / non-secure contexts.
 * Native: `@capacitor/clipboard` (loaded lazily).
 *
 * Returns user-friendly errors; never leaks the underlying API surface.
 */
import { isNative } from "./runtime";

export class ClipboardError extends Error {
  constructor(
    public readonly code: "unsupported" | "denied" | "unknown",
    message: string,
  ) {
    super(message);
    this.name = "ClipboardError";
  }
}

export interface PlatformClipboard {
  write(text: string): Promise<void>;
  read(): Promise<string>;
}

function legacyWrite(text: string): boolean {
  if (typeof document === "undefined") return false;
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

const webClipboard: PlatformClipboard = {
  async write(text) {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (err) {
        // Fall through to legacy fallback (e.g. user gesture missing, perm denied).
        if (legacyWrite(text)) return;
        const msg = (err as Error)?.message ?? "";
        if (/denied|not allowed/i.test(msg)) {
          throw new ClipboardError("denied", "Couldn't access the clipboard.");
        }
        throw new ClipboardError("unknown", "Couldn't copy to the clipboard.");
      }
    }
    if (legacyWrite(text)) return;
    throw new ClipboardError("unsupported", "Clipboard isn't available in this browser.");
  },
  async read() {
    if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
      throw new ClipboardError("unsupported", "Clipboard isn't available in this browser.");
    }
    try {
      return await navigator.clipboard.readText();
    } catch {
      throw new ClipboardError("denied", "Couldn't read from the clipboard.");
    }
  },
};

const nativeClipboard: PlatformClipboard = {
  async write(text) {
    try {
      const { Clipboard } = await import("@capacitor/clipboard");
      await Clipboard.write({ string: text });
    } catch (err) {
      throw new ClipboardError(
        "unknown",
        (err as Error)?.message ?? "Couldn't copy to the clipboard.",
      );
    }
  },
  async read() {
    try {
      const { Clipboard } = await import("@capacitor/clipboard");
      const { value } = await Clipboard.read();
      return value ?? "";
    } catch (err) {
      throw new ClipboardError(
        "unknown",
        (err as Error)?.message ?? "Couldn't read from the clipboard.",
      );
    }
  },
};

export const platformClipboard: PlatformClipboard = isNative() ? nativeClipboard : webClipboard;
