/**
 * PlatformSpeech — speech-to-text abstraction.
 *
 * Web: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).
 *      Unavailable in iOS WKWebView / Android WebView — guard with isSupported().
 * Native: wired in Phase 5 via `@capacitor-community/speech-recognition`.
 *
 * Phase 2 ships the web implementation only; the native impl is a TODO that
 * throws a clear error so callers can render a fallback ("Voice unavailable
 * on this device — please type your notes").
 */
import { isNative } from "./runtime";

export interface SpeechResult {
  transcript: string;
  isFinal: boolean;
}

export interface PlatformSpeech {
  isSupported(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  start(opts: { lang?: string; onResult: (r: SpeechResult) => void; onError?: (e: Error) => void; onEnd?: () => void }): Promise<void>;
  stop(): Promise<void>;
}

type SR = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: unknown) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onend: (() => void) | null;
};

function getWebSpeechCtor(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

let currentWebInstance: SR | null = null;

const webSpeech: PlatformSpeech = {
  async isSupported() {
    return getWebSpeechCtor() !== null;
  },
  async requestPermission() {
    // Browser asks for mic the first time recognition starts; nothing to do here.
    return true;
  },
  async start({ lang = "en-US", onResult, onError, onEnd }) {
    const Ctor = getWebSpeechCtor();
    if (!Ctor) throw new Error("Speech recognition is not supported in this browser.");
    const inst = new Ctor();
    inst.continuous = true;
    inst.interimResults = true;
    inst.lang = lang;
    inst.onresult = (e: unknown) => {
      const evt = e as { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }>; resultIndex: number };
      for (let i = evt.resultIndex; i < evt.results.length; i++) {
        const res = evt.results[i];
        onResult({ transcript: res[0].transcript, isFinal: res.isFinal });
      }
    };
    inst.onerror = (e) => onError?.(new Error(String((e as { error?: string }).error ?? "speech_error")));
    inst.onend = () => {
      currentWebInstance = null;
      onEnd?.();
    };
    currentWebInstance = inst;
    inst.start();
  },
  async stop() {
    currentWebInstance?.stop();
    currentWebInstance = null;
  },
};

const nativeSpeechTodo: PlatformSpeech = {
  async isSupported() {
    return false;
  },
  async requestPermission() {
    return false;
  },
  async start() {
    throw new Error("Native speech recognition will be wired in Phase 5 via @capacitor-community/speech-recognition.");
  },
  async stop() {
    /* no-op */
  },
};

export const platformSpeech: PlatformSpeech = isNative() ? nativeSpeechTodo : webSpeech;
