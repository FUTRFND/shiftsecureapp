/**
 * Lightweight telemetry layer.
 *
 * Captures non-sensitive operational events for production diagnostics:
 * platform, app version, request IDs, timing, error codes. No PHI, no
 * transcripts, no auth tokens.
 *
 * Sinks are pluggable. Default sink: console (dev) / no-op (prod web).
 * Native sink hook is reserved for a future Sentry/Bugsnag integration —
 * adding one only touches this file.
 */
import { isNative, getPlatform } from "@/platform/runtime";

export type TelemetrySeverity = "debug" | "info" | "warn" | "error";

export interface TelemetryEvent {
  /** Stable dot-namespaced name, e.g. "ai.summarize.success" */
  name: string;
  severity: TelemetrySeverity;
  /** Non-sensitive primitive props only — strings, numbers, booleans. */
  props?: Record<string, string | number | boolean | undefined>;
  /** Millisecond duration if this event represents a timed operation. */
  durationMs?: number;
  timestamp: number;
}

export interface TelemetrySink {
  capture(event: TelemetryEvent): void;
}

const APP_VERSION =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_APP_VERSION) ||
  "0.0.0-dev";

// ---- Sensitive-key guard --------------------------------------------------
// Defensive denylist — props that ever match are dropped before emission.
const FORBIDDEN_KEYS = [
  "transcript",
  "context",
  "summary",
  "patient",
  "email",
  "password",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "phone",
  "address",
  "ssn",
  "dob",
];

function sanitize(
  props?: Record<string, string | number | boolean | undefined>,
): Record<string, string | number | boolean | undefined> | undefined {
  if (!props) return undefined;
  const out: Record<string, string | number | boolean | undefined> = {};
  for (const [key, value] of Object.entries(props)) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_KEYS.some((k) => lower.includes(k))) continue;
    if (typeof value === "string" && value.length > 200) {
      out[key] = value.slice(0, 200);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// ---- Sink registry --------------------------------------------------------
const sinks: TelemetrySink[] = [];

const consoleSink: TelemetrySink = {
  capture(event) {
    const fn =
      event.severity === "error"
        ? console.error
        : event.severity === "warn"
          ? console.warn
          : console.log;
    fn(`[telemetry] ${event.name}`, {
      ...event.props,
      durationMs: event.durationMs,
    });
  },
};

const isDev =
  typeof import.meta !== "undefined" &&
  (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

if (isDev) sinks.push(consoleSink);

export function registerTelemetrySink(sink: TelemetrySink): () => void {
  sinks.push(sink);
  return () => {
    const i = sinks.indexOf(sink);
    if (i >= 0) sinks.splice(i, 1);
  };
}

// ---- Public API -----------------------------------------------------------
function emit(
  name: string,
  severity: TelemetrySeverity,
  props?: Record<string, string | number | boolean | undefined>,
  durationMs?: number,
) {
  const event: TelemetryEvent = {
    name,
    severity,
    props: {
      platform: getPlatform(),
      native: isNative(),
      appVersion: APP_VERSION,
      ...sanitize(props),
    },
    durationMs,
    timestamp: Date.now(),
  };
  for (const sink of sinks) {
    try {
      sink.capture(event);
    } catch {
      // never let a sink break the app
    }
  }
}

export const telemetry = {
  debug(name: string, props?: TelemetryEvent["props"]) {
    emit(name, "debug", props);
  },
  info(name: string, props?: TelemetryEvent["props"]) {
    emit(name, "info", props);
  },
  warn(name: string, props?: TelemetryEvent["props"]) {
    emit(name, "warn", props);
  },
  error(name: string, props?: TelemetryEvent["props"]) {
    emit(name, "error", props);
  },
  /** Time an async operation and emit success/failure with durationMs. */
  async time<T>(
    name: string,
    fn: () => Promise<T>,
    extraProps?: TelemetryEvent["props"],
  ): Promise<T> {
    const start =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    try {
      const result = await fn();
      emit(
        `${name}.success`,
        "info",
        extraProps,
        Math.round(
          (typeof performance !== "undefined" ? performance.now() : Date.now()) -
            start,
        ),
      );
      return result;
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: unknown }).code ?? "unknown")
          : err instanceof Error
            ? err.name
            : "unknown";
      emit(
        `${name}.failure`,
        "error",
        { ...extraProps, code },
        Math.round(
          (typeof performance !== "undefined" ? performance.now() : Date.now()) -
            start,
        ),
      );
      throw err;
    }
  },
};
