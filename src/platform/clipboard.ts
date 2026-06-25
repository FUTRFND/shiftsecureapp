/**
 * PlatformClipboard — copy-to-clipboard abstraction.
 * Web: `navigator.clipboard`.
 * Native: `@capacitor/clipboard` (added in Phase 5).
 */
import { isNative } from "./runtime";

export interface PlatformClipboard {
  write(text: string): Promise<void>;
  read(): Promise<string>;
}

const webClipboard: PlatformClipboard = {
  async write(text) {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      throw new Error("Clipboard API unavailable");
    }
    await navigator.clipboard.writeText(text);
  },
  async read() {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      throw new Error("Clipboard API unavailable");
    }
    return navigator.clipboard.readText();
  },
};

const nativeClipboard: PlatformClipboard = {
  async write(text) {
    const { Clipboard } = await import("@capacitor/clipboard");
    await Clipboard.write({ string: text });
  },
  async read() {
    const { Clipboard } = await import("@capacitor/clipboard");
    const { value } = await Clipboard.read();
    return value;
  },
};

export const platformClipboard: PlatformClipboard = isNative() ? nativeClipboard : webClipboard;
