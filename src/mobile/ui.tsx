// Shared native mobile UI kit: tokens, spinner, empty state, confirm
// dialog, pull-to-refresh, keyboard handling, screen transition. Plain
// HTML only — no router/UI libs, safe for the Capacitor WebView.
import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

// ---- Design tokens -------------------------------------------------------

export const palette = {
  bg: "#f2f2f7",          // iOS system grouped background
  ink: "#1c1c1e",
  muted: "#5b5b60",
  subtle: "#8e8e93",
  border: "#1c1c1e",
  hairline: "#d8d8de",
  surface: "#ffffff",
  surfaceAlt: "#ebebf0",
  accent: "#0a84ff",       // iOS system blue
  critical: "#d70015",
  warning: "#b15c00",
  info: "#1b4d8f",
  ok: "#0a7a3b",
  overlay: "rgba(20,20,22,0.45)",
};

export const radii = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 18,
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const shadow = {
  card: "0 1px 2px rgba(20,20,22,0.05), 0 1px 1px rgba(20,20,22,0.04)",
  raised: "0 8px 24px rgba(20,20,22,0.12)",
};

const SYS_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, sans-serif';

export const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  boxSizing: "border-box",
  padding: `calc(env(safe-area-inset-top, 0px) + ${space.lg}px) ${space.lg}px 96px`,
  background: palette.bg,
  color: palette.ink,
  fontFamily: SYS_FONT,
  WebkitFontSmoothing: "antialiased",
  letterSpacing: -0.01,
};


// iOS-style controls: 44pt min height, 10pt radius, system font, 16pt input
// text so iOS does not zoom on focus.

export const buttonBase: React.CSSProperties = {
  minHeight: 44,
  border: `1px solid ${palette.border}`,
  background: palette.surface,
  color: palette.ink,
  fontSize: 15,
  fontWeight: 600,
  padding: "0 16px",
  borderRadius: radii.md,
  font: "inherit",
  fontFamily: SYS_FONT,
  cursor: "pointer",
  touchAction: "manipulation",
  WebkitAppearance: "none",
  WebkitTapHighlightColor: "transparent",
  transition: "opacity 120ms ease, transform 120ms ease",
};

export const primaryButton: React.CSSProperties = {
  ...buttonBase,
  background: palette.ink,
  color: palette.surface,
};

export const dangerButton: React.CSSProperties = {
  ...buttonBase,
  background: palette.critical,
  borderColor: palette.critical,
  color: palette.surface,
};

export const ghostButton: React.CSSProperties = {
  ...buttonBase,
  background: "transparent",
  border: `1px solid ${palette.hairline}`,
  color: palette.ink,
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 44,
  padding: "10px 12px",
  fontSize: 16, // ≥16px = no iOS zoom on focus
  border: `1px solid ${palette.border}`,
  borderRadius: radii.md,
  background: palette.surface,
  color: palette.ink,
  font: "inherit",
  fontFamily: SYS_FONT,
  marginBottom: space.sm,
  scrollMarginBottom: 120,
};

export const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 84,
  paddingTop: 10,
  resize: "vertical",
};

export const selectStyle: React.CSSProperties = {
  ...inputStyle,
  WebkitAppearance: "none",
  appearance: "none",
  backgroundImage:
    "linear-gradient(45deg, transparent 50%, #121212 50%), linear-gradient(135deg, #121212 50%, transparent 50%)",
  backgroundPosition:
    "calc(100% - 18px) calc(50% - 3px), calc(100% - 12px) calc(50% - 3px)",
  backgroundSize: "6px 6px, 6px 6px",
  backgroundRepeat: "no-repeat",
  paddingRight: 32,
};

export const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: palette.muted,
  marginBottom: space.xs,
};

export const cardStyle: React.CSSProperties = {
  background: palette.surface,
  border: `1px solid ${palette.hairline}`,
  borderRadius: radii.lg,
  padding: space.lg,
};

// ---- One-shot global stylesheet (animations, focus polish) ---------------

let stylesInjected = false;
function ensureGlobalStyles() {
  if (stylesInjected || typeof document === "undefined") return;
  stylesInjected = true;
  const css = `
@keyframes mobile-spin { to { transform: rotate(360deg) } }
@keyframes mobile-fade-in {
  from { opacity: 0; transform: translateY(6px) }
  to   { opacity: 1; transform: translateY(0) }
}
.mobile-screen-fade { animation: mobile-fade-in 180ms ease-out both; }
.mobile-tap:active { opacity: 0.75; transform: scale(0.98); }
`;
  const el = document.createElement("style");
  el.setAttribute("data-mobile-ui", "true");
  el.textContent = css;
  document.head.appendChild(el);
}

// ---- Spinner -------------------------------------------------------------

export function Spinner({
  size = 18,
  color = palette.ink,
  label,
}: {
  size?: number;
  color?: string;
  label?: string;
}) {
  ensureGlobalStyles();
  return (
    <span
      role="status"
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        color: palette.muted,
        fontSize: 14,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          border: `2px solid ${palette.hairline}`,
          borderTopColor: color,
          animation: "mobile-spin 700ms linear infinite",
          display: "inline-block",
        }}
      />
      {label && <span>{label}</span>}
    </span>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        padding: `${space.xl}px 0`,
      }}
    >
      <Spinner label={label} />
    </div>
  );
}

// ---- Empty state ---------------------------------------------------------

export function EmptyState({
  icon = "✦",
  title,
  body,
  action,
}: {
  icon?: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        ...cardStyle,
        border: `1px dashed ${palette.hairline}`,
        background: palette.surfaceAlt,
        textAlign: "center",
        padding: `${space.xl}px ${space.lg}px`,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          fontSize: 28,
          color: palette.subtle,
          marginBottom: space.sm,
          lineHeight: 1,
        }}
      >
        {icon}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
        {title}
      </div>
      {body && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: palette.muted,
            lineHeight: 1.4,
          }}
        >
          {body}
        </p>
      )}
      {action && (
        <div style={{ marginTop: space.md, display: "inline-block" }}>
          {action}
        </div>
      )}
    </div>
  );
}

// ---- Confirm dialog ------------------------------------------------------

type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type PendingConfirm = ConfirmOptions & {
  resolve: (ok: boolean) => void;
};

export function useConfirm(): {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  dialog: React.ReactNode;
} {
  ensureGlobalStyles();
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const titleId = useId();

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...opts, resolve });
      }),
    [],
  );

  const close = useCallback(
    (ok: boolean) => {
      if (!pending) return;
      pending.resolve(ok);
      setPending(null);
    },
    [pending],
  );

  const dialog = pending ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={() => close(false)}
      style={{
        position: "fixed",
        inset: 0,
        background: palette.overlay,
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: space.lg,
        paddingBottom: `calc(${space.lg}px + env(safe-area-inset-bottom, 0px))`,
        fontFamily: SYS_FONT,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 380,
          background: palette.surface,
          borderRadius: radii.lg,
          padding: space.lg,
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
          animation: "mobile-fade-in 180ms ease-out both",
        }}
      >
        <h2
          id={titleId}
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 700,
            color: palette.ink,
          }}
        >
          {pending.title}
        </h2>
        {pending.body && (
          <p
            style={{
              margin: `${space.sm}px 0 0`,
              fontSize: 14,
              color: palette.muted,
              lineHeight: 1.4,
            }}
          >
            {pending.body}
          </p>
        )}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: space.sm,
            marginTop: space.lg,
          }}
        >
          <button
            type="button"
            className="mobile-tap"
            style={ghostButton}
            onClick={() => close(false)}
          >
            {pending.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            className="mobile-tap"
            style={pending.destructive ? dangerButton : primaryButton}
            onClick={() => close(true)}
            autoFocus
          >
            {pending.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, dialog };
}

// ---- Pull-to-refresh -----------------------------------------------------

// Touch-only pull-to-refresh on the window. Triggers when the user pulls
// from scrollTop=0 by at least `threshold` pixels. The hook returns an
// indicator that can be rendered anywhere — typically at the top of the
// screen — and a `refreshing` flag.
const PTR_THRESHOLD = 70;
const PTR_MAX = 110;

export function usePullToRefresh(
  onRefresh: () => Promise<void> | void,
  options?: { enabled?: boolean },
) {
  ensureGlobalStyles();
  const enabled = options?.enabled !== false;
  const [pullPx, setPullPx] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const activeRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      if ((window.scrollY || document.documentElement.scrollTop) > 0) return;
      startY.current = e.touches[0]?.clientY ?? null;
      activeRef.current = true;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!activeRef.current || startY.current === null) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
      if (dy <= 0) {
        setPullPx(0);
        return;
      }
      // Rubber-band: divide by 1.8.
      const px = Math.min(PTR_MAX, dy / 1.8);
      setPullPx(px);
    };
    const onTouchEnd = () => {
      if (!activeRef.current) return;
      activeRef.current = false;
      startY.current = null;
      if (pullPx >= PTR_THRESHOLD && !refreshing) {
        setRefreshing(true);
        setPullPx(PTR_THRESHOLD);
        Promise.resolve(onRefreshRef.current())
          .catch(() => undefined)
          .finally(() => {
            setRefreshing(false);
            setPullPx(0);
          });
      } else {
        setPullPx(0);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [enabled, pullPx, refreshing]);

  const progress = Math.min(1, pullPx / PTR_THRESHOLD);
  const indicator = useMemo(
    () => (
      <div
        aria-hidden={!refreshing && pullPx === 0}
        style={{
          height: pullPx,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          overflow: "hidden",
          transition: refreshing ? "height 180ms ease" : undefined,
          marginTop: -8,
          marginBottom: pullPx > 0 ? 8 : 0,
        }}
      >
        {pullPx > 0 &&
          (refreshing ? (
            <Spinner size={18} label="Refreshing…" />
          ) : (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                color: palette.muted,
                fontSize: 13,
                opacity: 0.5 + 0.5 * progress,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  transform: `rotate(${progress >= 1 ? 180 : 0}deg)`,
                  transition: "transform 120ms ease",
                }}
              >
                ↓
              </span>
              {progress >= 1 ? "Release to refresh" : "Pull to refresh"}
            </span>
          ))}
      </div>
    ),
    [pullPx, progress, refreshing],
  );

  return { refreshing, indicator };
}

// ---- Keyboard handling ---------------------------------------------------

// Scrolls the focused input into view so it remains visible above the
// virtual keyboard. Safe on web (where it's a small no-op scroll).
export function useKeyboardScrollIntoView() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return;
      // Defer so the on-screen keyboard has time to appear.
      window.setTimeout(() => {
        try {
          t.scrollIntoView({ block: "center", behavior: "smooth" });
        } catch {
          // ignore
        }
      }, 250);
    };
    document.addEventListener("focusin", handler);
    return () => document.removeEventListener("focusin", handler);
  }, []);
}

// ---- Screen transition ---------------------------------------------------

export function ScreenFade({
  children,
  k,
}: {
  children: React.ReactNode;
  /** Unique key for the active screen so React remounts on change. */
  k: string;
}) {
  ensureGlobalStyles();
  return (
    <div key={k} className="mobile-screen-fade">
      {children}
    </div>
  );
}
