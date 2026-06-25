/**
 * PlatformSpeech — speech-to-text abstraction.
 *
 * Web: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).
 *      Unavailable in iOS WKWebView / Android WebView — guard with isSupported().
 * Native: `@capacitor-community/speech-recognition` (iOS Speech framework +
 *         Android SpeechRecognizer). Loaded via dynamic import so the web
 *         bundle never pulls native plugin code.
 *
 * Screens consume this through a single `platformSpeech` instance. They never
 * import the plugin or the Web Speech API directly.
 */
import { isNative } from "./runtime";

export interface SpeechResult {
  /** Current transcript fragment. On native this is the cumulative best guess
   *  for the in-flight utterance; on web it is the new chunk. */
  transcript: string;
  /** True once the engine commits the fragment. Use for "live" interim UI vs
   *  the durable final transcript. */
  isFinal: boolean;
}

export interface StartSpeechOptions {
  lang?: string;
  /** Inactivity (no recognized speech) before the engine auto-stops, ms.
   *  Web ignores this; native uses it to keep continuous dictation alive. */
  silenceTimeoutMs?: number;
  /** Try to stream partial results. Web always does; native does when supported. */
  partialResults?: boolean;
  onResult: (r: SpeechResult) => void;
  /** Single error sink. Codes match the SpeechError enum below. */
  onError?: (e: SpeechError) => void;
  /** Fires exactly once when the session terminates (stop, cancel, timeout,
   *  or error). Resources are released before this runs. */
  onEnd?: () => void;
}

export type SpeechErrorCode =
  | "not_supported"
  | "permission_denied"
  | "mic_unavailable"
  | "network"
  | "no_speech"
  | "aborted"
  | "timeout"
  | "unknown";

export class SpeechError extends Error {
  constructor(
    public readonly code: SpeechErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SpeechError";
  }
}

export interface PlatformSpeech {
  isSupported(): Promise<boolean>;
  checkPermission(): Promise<"granted" | "denied" | "prompt">;
  requestPermission(): Promise<boolean>;
  start(opts: StartSpeechOptions): Promise<void>;
  /** Stop and commit any in-flight partial transcript. */
  stop(): Promise<void>;
  /** Stop and discard any in-flight partial transcript. */
  cancel(): Promise<void>;
  isListening(): Promise<boolean>;
}

// ---------- Web implementation -------------------------------------------------

type WebSRResultItem = { transcript: string; confidence: number };
type WebSRResult = ArrayLike<WebSRResultItem> & { isFinal: boolean };
type WebSREvent = { results: ArrayLike<WebSRResult>; resultIndex: number };
type WebSRErrorEvent = { error?: string };
type WebSR = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: WebSREvent) => void) | null;
  onerror: ((e: WebSRErrorEvent) => void) | null;
  onend: (() => void) | null;
};

function getWebSpeechCtor(): (new () => WebSR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => WebSR;
    webkitSpeechRecognition?: new () => WebSR;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function makeWebSpeech(): PlatformSpeech {
  let current: WebSR | null = null;
  let cancelled = false;

  const release = () => {
    current = null;
    cancelled = false;
  };

  return {
    async isSupported() {
      return getWebSpeechCtor() !== null;
    },
    async checkPermission() {
      // Browsers don't expose mic permission per recognizer; the prompt fires
      // on first start. Treat as "prompt" until then.
      return "prompt";
    },
    async requestPermission() {
      // Nothing to do — the recognizer triggers the browser prompt itself.
      return true;
    },
    async start({ lang = "en-US", partialResults = true, onResult, onError, onEnd }) {
      if (current) {
        // Defensive: a stale instance from a prior session.
        try {
          current.abort();
        } catch {
          /* noop */
        }
        current = null;
      }
      const Ctor = getWebSpeechCtor();
      if (!Ctor) {
        onError?.(
          new SpeechError(
            "not_supported",
            "Voice capture isn't supported in this browser. Try Chrome, Edge, or Safari.",
          ),
        );
        onEnd?.();
        return;
      }
      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = partialResults;
      rec.lang = lang;
      cancelled = false;
      rec.onresult = (e) => {
        if (cancelled) return;
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          onResult({ transcript: r[0].transcript, isFinal: r.isFinal });
        }
      };
      rec.onerror = (e) => {
        const raw = e.error ?? "unknown";
        if (raw === "no-speech") {
          // Non-fatal; recognizer ends right after.
          onError?.(new SpeechError("no_speech", "Didn't catch anything — try again."));
          return;
        }
        if (raw === "aborted") return; // surfaced by cancel()
        const map: Record<string, SpeechErrorCode> = {
          "not-allowed": "permission_denied",
          "service-not-allowed": "permission_denied",
          "audio-capture": "mic_unavailable",
          network: "network",
        };
        const code = map[raw] ?? "unknown";
        onError?.(new SpeechError(code, friendlyMessage(code)));
      };
      rec.onend = () => {
        release();
        onEnd?.();
      };
      current = rec;
      try {
        rec.start();
      } catch (err) {
        release();
        onError?.(
          new SpeechError("unknown", (err as Error)?.message ?? "Couldn't start recording."),
        );
        onEnd?.();
      }
    },
    async stop() {
      current?.stop();
    },
    async cancel() {
      cancelled = true;
      current?.abort();
    },
    async isListening() {
      return current !== null;
    },
  };
}

// ---------- Native (Capacitor) implementation ---------------------------------

function makeNativeSpeech(): PlatformSpeech {
  // Listener handles for partial / end / error from the plugin.
  let partialHandle: { remove: () => void | Promise<void> } | null = null;
  let listeningStateHandle: { remove: () => void | Promise<void> } | null = null;
  let listening = false;
  let cancelled = false;
  let currentOnEnd: (() => void) | null = null;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;

  const teardown = async () => {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
    try {
      await partialHandle?.remove();
    } catch {
      /* noop */
    }
    try {
      await listeningStateHandle?.remove();
    } catch {
      /* noop */
    }
    partialHandle = null;
    listeningStateHandle = null;
    listening = false;
  };

  const fireEnd = () => {
    const cb = currentOnEnd;
    currentOnEnd = null;
    cb?.();
  };

  return {
    async isSupported() {
      try {
        const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
        const { available } = await SpeechRecognition.available();
        return Boolean(available);
      } catch {
        return false;
      }
    },
    async checkPermission() {
      try {
        const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
        const { speechRecognition: permission } = await SpeechRecognition.checkPermissions();
        if (permission === "granted") return "granted";
        if (permission === "denied") return "denied";
        return "prompt";
      } catch {
        return "denied";
      }
    },
    async requestPermission() {
      try {
        const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
        const { speechRecognition: permission } = await SpeechRecognition.requestPermissions();
        return permission === "granted";
      } catch {
        return false;
      }
    },
    async start({
      lang = "en-US",
      silenceTimeoutMs = 3500,
      partialResults = true,
      onResult,
      onError,
      onEnd,
    }) {
      if (listening) {
        // Hard guard against duplicate sessions.
        onError?.(new SpeechError("unknown", "Recording is already in progress."));
        return;
      }
      let SpeechRecognition: typeof import("@capacitor-community/speech-recognition").SpeechRecognition;
      try {
        ({ SpeechRecognition } = await import("@capacitor-community/speech-recognition"));
      } catch {
        onError?.(
          new SpeechError("not_supported", "Voice capture isn't available on this device."),
        );
        onEnd?.();
        return;
      }

      try {
        const { available } = await SpeechRecognition.available();
        if (!available) {
          onError?.(
            new SpeechError("not_supported", "Voice capture isn't available on this device."),
          );
          onEnd?.();
          return;
        }
      } catch {
        onError?.(
          new SpeechError("not_supported", "Voice capture isn't available on this device."),
        );
        onEnd?.();
        return;
      }

      // Ensure permission before starting.
      try {
        const { speechRecognition: permission } = await SpeechRecognition.checkPermissions();
        if (permission !== "granted") {
          const { speechRecognition: next } = await SpeechRecognition.requestPermissions();
          if (next !== "granted") {
            onError?.(new SpeechError("permission_denied", friendlyMessage("permission_denied")));
            onEnd?.();
            return;
          }
        }
      } catch {
        onError?.(new SpeechError("permission_denied", friendlyMessage("permission_denied")));
        onEnd?.();
        return;
      }

      currentOnEnd = onEnd ?? null;
      cancelled = false;

      const armSilenceTimer = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          // Native engines stop themselves on silence on some platforms.
          // Force-stop here to keep the timeout consistent across iOS/Android.
          void SpeechRecognition.stop().catch(() => {
            /* swallow */
          });
        }, silenceTimeoutMs);
      };

      try {
        if (partialResults) {
          partialHandle = await SpeechRecognition.addListener(
            "partialResults",
            (data: { matches?: string[] }) => {
              if (cancelled) return;
              const text = data?.matches?.[0];
              if (typeof text === "string" && text.length > 0) {
                onResult({ transcript: text, isFinal: false });
                armSilenceTimer();
              }
            },
          );
        }
        listeningStateHandle = await SpeechRecognition.addListener(
          "listeningState",
          (data: { status?: "started" | "stopped" }) => {
            if (data?.status === "stopped") {
              void teardown().finally(() => {
                if (!cancelled) {
                  // No reliable "final result" event on every platform — the
                  // last partial is the final. The screen merges partials, so
                  // nothing extra to emit here.
                }
                fireEnd();
              });
            }
          },
        );
      } catch (err) {
        await teardown();
        onError?.(
          new SpeechError("unknown", (err as Error)?.message ?? "Couldn't start recording."),
        );
        fireEnd();
        return;
      }

      try {
        // popup: false → no system UI; we render our own. partialResults
        // streamed via the listener above.
        await SpeechRecognition.start({
          language: lang,
          maxResults: 1,
          partialResults,
          popup: false,
        });
        listening = true;
        armSilenceTimer();
      } catch (err) {
        await teardown();
        const message = (err as Error)?.message ?? "";
        const code: SpeechErrorCode = /denied|permission/i.test(message)
          ? "permission_denied"
          : /microphone|audio/i.test(message)
            ? "mic_unavailable"
            : "unknown";
        onError?.(new SpeechError(code, friendlyMessage(code)));
        fireEnd();
      }
    },
    async stop() {
      if (!listening) return;
      try {
        const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
        await SpeechRecognition.stop();
      } catch {
        // teardown still fires via listeningState; ignore.
      }
    },
    async cancel() {
      if (!listening) return;
      cancelled = true;
      try {
        const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
        await SpeechRecognition.stop();
      } catch {
        /* noop */
      }
    },
    async isListening() {
      return listening;
    },
  };
}

function friendlyMessage(code: SpeechErrorCode): string {
  switch (code) {
    case "permission_denied":
      return "Microphone access is required. Enable it in your device settings.";
    case "mic_unavailable":
      return "Microphone is unavailable. Close other apps using it and try again.";
    case "not_supported":
      return "Voice capture isn't available on this device.";
    case "network":
      return "Speech recognition needs a network connection. Check your connection and try again.";
    case "no_speech":
      return "Didn't catch anything — try again.";
    case "aborted":
      return "Recording cancelled.";
    case "timeout":
      return "Recording stopped after a long silence.";
    default:
      return "Couldn't record audio. Please try again.";
  }
}

export const platformSpeech: PlatformSpeech = isNative() ? makeNativeSpeech() : makeWebSpeech();
