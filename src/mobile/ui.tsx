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

// Shift Secure brand: calm green primary, off-white green background.
// Tuned for an Apple-style grouped feel (Reminders / Notes / Health).
export const palette = {
  bg: "#f4f8f5",           // very light green / off-white
  bgAlt: "#eef3ef",
  ink: "#1c2024",          // never harsh black
  muted: "#5b6168",
  subtle: "#8a9099",
  border: "#1c2024",
  hairline: "#e3e8e4",     // very light gray-green
  surface: "#ffffff",
  surfaceAlt: "#f1f5f2",
  accent: "#16a34a",       // brand green
  accentSoft: "#dcf2e3",
  accentDeep: "#0f7a37",
  accentGlow: "#22c55e",
  critical: "#d7263d",
  criticalSoft: "#fde7ea",
  warning: "#b46a00",
  warningSoft: "#fdeecf",
  info: "#1d5bbf",
  infoSoft: "#e2ecff",
  ok: "#0f7a37",
  overlay: "rgba(20,24,28,0.45)",
};

// Brand gradient used on primary CTAs and key surfaces.
export const gradient = {
  primary: `linear-gradient(135deg, ${palette.accent} 0%, ${palette.accentGlow} 100%)`,
  primaryDeep: `linear-gradient(135deg, ${palette.accentDeep} 0%, ${palette.accent} 100%)`,
  page: `linear-gradient(180deg, ${palette.bg} 0%, ${palette.bgAlt} 100%)`,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
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
  hairline: "0 0 0 1px rgba(20,24,28,0.04)",
  card: "0 1px 2px rgba(20,24,28,0.04), 0 4px 14px rgba(20,24,28,0.05)",
  raised: "0 10px 30px rgba(20,24,28,0.12)",
  primary: "0 6px 18px rgba(22,163,74,0.32)",
};

// Apple typography scale (in px). Match HIG: Large Title 34, Title1 28, etc.
export const type = {
  largeTitle: 34,
  title1: 28,
  title2: 22,
  title3: 20,
  headline: 17,
  body: 16,
  callout: 15,
  subhead: 14,
  footnote: 13,
  caption: 12,
};

const SYS_FONT =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, sans-serif';

export const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  boxSizing: "border-box",
  padding: `calc(env(safe-area-inset-top, 0px) + ${space.lg}px) ${space.lg}px 96px`,
  background: gradient.page,
  color: palette.ink,
  fontFamily: SYS_FONT,
  WebkitFontSmoothing: "antialiased",
  letterSpacing: -0.01,
};


// iOS-style controls: 44pt min height, 12pt radius, system font, 16pt input
// text so iOS does not zoom on focus.

export const buttonBase: React.CSSProperties = {
  minHeight: 44,
  border: `1px solid ${palette.hairline}`,
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
  transition: "opacity 120ms ease, transform 120ms ease, background 120ms ease, box-shadow 160ms ease",
};

// Brand-gradient primary CTA (Sign in, Save, Publish).
export const primaryButton: React.CSSProperties = {
  ...buttonBase,
  background: gradient.primary,
  borderColor: "transparent",
  color: "#ffffff",
  boxShadow: shadow.primary,
  fontWeight: 700,
};

export const accentButton: React.CSSProperties = {
  ...buttonBase,
  background: palette.accent,
  borderColor: palette.accent,
  color: "#ffffff",
};

export const dangerButton: React.CSSProperties = {
  ...buttonBase,
  background: palette.critical,
  borderColor: palette.critical,
  color: palette.surface,
};

export const ghostButton: React.CSSProperties = {
  ...buttonBase,
  background: palette.surface,
  border: `1px solid ${palette.hairline}`,
  color: palette.ink,
};

export const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 48,
  padding: "12px 14px",
  fontSize: 16,
  border: `1px solid ${palette.hairline}`,
  borderRadius: radii.md,
  background: palette.surface,
  color: palette.ink,
  font: "inherit",
  fontFamily: SYS_FONT,
  marginBottom: space.sm,
  scrollMarginBottom: 120,
  outline: "none",
  transition: "border-color 140ms ease, box-shadow 140ms ease",
};

export const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 96,
  paddingTop: 12,
  resize: "vertical",
  lineHeight: 1.4,
};

export const selectStyle: React.CSSProperties = {
  ...inputStyle,
  WebkitAppearance: "none",
  appearance: "none",
  backgroundImage:
    "linear-gradient(45deg, transparent 50%, #1c2024 50%), linear-gradient(135deg, #1c2024 50%, transparent 50%)",
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
  letterSpacing: 0.6,
  color: palette.muted,
  marginBottom: space.xs,
};

export const cardStyle: React.CSSProperties = {
  background: palette.surface,
  border: `1px solid ${palette.hairline}`,
  borderRadius: radii.xl,
  padding: space.lg,
  boxShadow: shadow.card,
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
@keyframes mobile-banner-in {
  from { opacity: 0; transform: translateY(-4px) }
  to   { opacity: 1; transform: translateY(0) }
}
@keyframes mobile-shimmer {
  0%   { background-position: -400px 0 }
  100% { background-position: 400px 0 }
}
.mobile-screen-fade { animation: mobile-fade-in 220ms ease-out both; }
.mobile-tap:active:not(:disabled) { opacity: 0.85; transform: scale(0.985); }
.mobile-tap:disabled { opacity: 0.45; cursor: default; }
button:disabled { cursor: default; }
input:focus, textarea:focus, select:focus {
  border-color: ${palette.accent} !important;
  box-shadow: 0 0 0 4px ${palette.accentSoft};
}
* { -webkit-tap-highlight-color: transparent; }
html, body { background: ${palette.bg}; overscroll-behavior-y: contain; }
.mobile-skeleton {
  background: linear-gradient(90deg, ${palette.surfaceAlt} 0%, #ffffff 50%, ${palette.surfaceAlt} 100%);
  background-size: 800px 100%;
  animation: mobile-shimmer 1.4s linear infinite;
  border-radius: 8px;
}
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

// ---- Banner (inline error / success / info) -----------------------------

export type BannerTone = "error" | "success" | "warning" | "info";

const BANNER_TONES: Record<
  BannerTone,
  { bg: string; fg: string; border: string; icon: string }
> = {
  error:   { bg: "#fdecee", fg: palette.critical, border: "#f6c6cc", icon: "!" },
  success: { bg: "#e8f5ec", fg: palette.ok,       border: "#bfe1c8", icon: "✓" },
  warning: { bg: "#fff4e0", fg: palette.warning,  border: "#f1d8a8", icon: "△" },
  info:    { bg: "#e6efff", fg: palette.info,     border: "#c2d3f0", icon: "i" },
};

export function Banner({
  tone = "info",
  children,
  onDismiss,
}: {
  tone?: BannerTone;
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  ensureGlobalStyles();
  const t = BANNER_TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        border: `1px solid ${t.border}`,
        background: t.bg,
        color: t.fg,
        padding: "10px 12px",
        borderRadius: radii.md,
        fontSize: 13,
        lineHeight: 1.35,
        marginBottom: space.md,
        animation: "mobile-banner-in 180ms ease-out both",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flex: "0 0 auto",
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: t.fg,
          color: "#fff",
          fontSize: 11,
          fontWeight: 800,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
        }}
      >
        {t.icon}
      </span>
      <div style={{ flex: 1, fontWeight: 500 }}>{children}</div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="mobile-tap"
          style={{
            border: "none",
            background: "transparent",
            color: t.fg,
            fontSize: 16,
            lineHeight: 1,
            padding: 4,
            cursor: "pointer",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ---- Screen header -------------------------------------------------------

export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: space.md,
        marginBottom: space.lg,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: -0.6,
            color: palette.ink,
            lineHeight: 1.1,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 13,
              color: palette.muted,
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {right && <div style={{ flex: "0 0 auto" }}>{right}</div>}
    </header>
  );
}

// ---- Confirm dialog ------------------------------------------------------

type ConfirmOptions = {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm?: () => void;
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
    <>
      <div
        aria-hidden="true"
        onClick={() => close(false)}
        style={{
          position: "fixed",
          inset: 0,
          background: palette.overlay,
          zIndex: 1000,
        }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1001,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          padding: space.lg,
          paddingBottom: `calc(${space.lg}px + env(safe-area-inset-bottom, 0px))`,
          fontFamily: SYS_FONT,
          pointerEvents: "none",
        }}
      >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={{
          width: "100%",
          maxWidth: 380,
          background: palette.surface,
          borderRadius: radii.lg,
          padding: space.lg,
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
          animation: "mobile-fade-in 180ms ease-out both",
          position: "relative",
          zIndex: 1002,
          pointerEvents: "auto",
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
            style={{ ...ghostButton, position: "relative", zIndex: 1003 }}
            onClick={() => close(false)}
          >
            {pending.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            className="mobile-tap"
            style={{ ...(pending.destructive ? dangerButton : primaryButton), position: "relative", zIndex: 1003 }}
            onClick={() => {
              pending.onConfirm?.();
              close(true);
            }}
            autoFocus
          >
            {pending.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
    </>
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

// ---- Card ---------------------------------------------------------------

export function Card({
  children,
  padded = true,
  style,
  onClick,
  as: As = "div",
}: {
  children: React.ReactNode;
  padded?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
  as?: "div" | "section" | "article";
}) {
  return (
    <As
      onClick={onClick}
      style={{
        ...cardStyle,
        padding: padded ? space.lg : 0,
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
    >
      {children}
    </As>
  );
}

// ---- Section header (within a screen) ------------------------------------

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        margin: `${space.lg}px 4px ${space.sm}px`,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          color: palette.muted,
        }}
      >
        {title}
      </h2>
      {action}
    </div>
  );
}

// ---- Pill / Chip / StatusBadge -------------------------------------------

export function Pill({
  tone = "neutral",
  children,
  dot,
}: {
  tone?: "neutral" | "success" | "warning" | "critical" | "info" | "accent";
  children: React.ReactNode;
  dot?: boolean;
}) {
  const tones: Record<string, { bg: string; fg: string }> = {
    neutral:  { bg: palette.surfaceAlt,   fg: palette.muted },
    success:  { bg: palette.accentSoft,   fg: palette.accentDeep },
    accent:   { bg: palette.accentSoft,   fg: palette.accentDeep },
    warning:  { bg: palette.warningSoft,  fg: palette.warning },
    critical: { bg: palette.criticalSoft, fg: palette.critical },
    info:     { bg: palette.infoSoft,     fg: palette.info },
  };
  const t = tones[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: t.bg,
        color: t.fg,
        borderRadius: radii.pill,
        padding: "4px 10px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.3,
        textTransform: "uppercase",
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {dot && (
        <span
          aria-hidden="true"
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: t.fg,
            display: "inline-block",
          }}
        />
      )}
      {children}
    </span>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mobile-tap"
      style={{
        height: 34,
        padding: "0 14px",
        borderRadius: radii.pill,
        border: `1px solid ${active ? palette.accent : palette.hairline}`,
        background: active ? palette.accentSoft : palette.surface,
        color: active ? palette.accentDeep : palette.ink,
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        fontFamily: "inherit",
        WebkitAppearance: "none",
        touchAction: "manipulation",
        transition: "background 140ms ease, color 140ms ease, border-color 140ms ease",
      }}
    >
      {children}
    </button>
  );
}

// ---- Skeleton loaders ----------------------------------------------------

export function Skeleton({
  width = "100%",
  height = 14,
  style,
}: {
  width?: number | string;
  height?: number | string;
  style?: React.CSSProperties;
}) {
  ensureGlobalStyles();
  return (
    <span
      className="mobile-skeleton"
      aria-hidden="true"
      style={{ display: "block", width, height, ...style }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div style={{ ...cardStyle, marginBottom: space.md }}>
      <Skeleton width={120} height={12} style={{ marginBottom: 12 }} />
      <Skeleton width="80%" height={16} style={{ marginBottom: 8 }} />
      <Skeleton width="60%" height={14} />
    </div>
  );
}

// ---- Floating Action Button ----------------------------------------------

export function FAB({
  onClick,
  label,
  icon = "+",
}: {
  onClick: () => void;
  label: string;
  icon?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="mobile-tap"
      style={{
        position: "fixed",
        right: 18,
        bottom: `calc(env(safe-area-inset-bottom, 0px) + 84px)`,
        height: 56,
        minWidth: 56,
        padding: "0 20px",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: gradient.primary,
        color: "#fff",
        border: "none",
        borderRadius: radii.pill,
        fontSize: 15,
        fontWeight: 700,
        boxShadow: shadow.primary,
        cursor: "pointer",
        zIndex: 25,
        fontFamily: "inherit",
        touchAction: "manipulation",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1, marginTop: -2 }}>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
