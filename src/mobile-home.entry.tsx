// Native mobile entry: Supabase auth (login/session) only, then MobileHome.
// No router, no AuthProvider, no Toaster, no native-shell, no Capacitor plugins.
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { createClient, type Session } from "@supabase/supabase-js";
import { AlertsScreen } from "./mobile/alerts";
import { TemplatesScreen } from "./mobile/templates";
import { TasksScreen } from "./mobile/tasks";
import { VoiceScreen } from "./mobile/voice";
import { HomeScreen } from "./mobile/home";
import {
  Banner,
  ScreenFade,
  Spinner,
  gradient,
  inputStyle,
  labelStyle,
  pageStyle,
  palette,
  primaryButton,
  radii,
  shadow,
  space,
} from "./mobile/ui";
import "./styles.css";

declare global {
  interface Window {
    __bootstrapError?: (label: string, payload: string) => void;
  }
}

const reportBoot = (label: string, payload: unknown) => {
  const msg =
    payload instanceof Error
      ? (payload.stack ?? payload.message)
      : typeof payload === "string"
        ? payload
        : JSON.stringify(payload);
  console.error("[bootstrap]", label, msg);
  window.__bootstrapError?.(label, msg);
};

const buildStamp = "MOBILE_HOME_AUTH_LOCAL_STATE";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  reportBoot(
    "env",
    `Missing Supabase env. VITE_SUPABASE_URL=${String(SUPABASE_URL)} VITE_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_PUBLISHABLE_KEY ? "set" : "missing"}`,
  );
}

// Minimal client: localStorage only. No Capacitor Preferences bridge yet.
const sb = createClient(SUPABASE_URL ?? "", SUPABASE_PUBLISHABLE_KEY ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});

const screens = ["Alerts", "Templates", "Tasks", "Voice"] as const;
type Screen = (typeof screens)[number];

const TAB_GLYPH: Record<Screen, string> = {
  Alerts: "!",
  Templates: "▤",
  Tasks: "✓",
  Voice: "●",
};

function MobileHome({
  email,
  userId,
  onSignOut,
}: {
  email: string;
  userId: string;
  onSignOut: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Screen>("Alerts");
  const goAlerts = () => setActiveTab("Alerts");

  const tabBarHeight = 68;
  const contentWrapStyle: React.CSSProperties = {
    paddingBottom: `calc(${tabBarHeight}px + env(safe-area-inset-bottom, 0px))`,
    minHeight: "100vh",
    background: palette.bg,
  };

  let screen: React.ReactNode = null;
  if (activeTab === "Alerts") {
    screen = <AlertsScreen sb={sb} userId={userId} onBack={goAlerts} />;
  } else if (activeTab === "Templates") {
    screen = <TemplatesScreen sb={sb} userId={userId} onBack={goAlerts} />;
  } else if (activeTab === "Tasks") {
    screen = <TasksScreen sb={sb} userId={userId} onBack={goAlerts} />;
  } else if (activeTab === "Voice") {
    screen = <VoiceScreen sb={sb} userId={userId} onBack={goAlerts} />;
  }

  return (
    <div data-mobile-build={buildStamp} style={{ position: "relative" }}>
      <div style={contentWrapStyle}>
        <ScreenFade k={activeTab}>{screen}</ScreenFade>
      </div>

      <button
        type="button"
        onClick={onSignOut}
        aria-label={`Sign out ${email}`}
        title={`Sign out ${email}`}
        className="mobile-tap"
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0px) + 10px)",
          right: 12,
          height: 32,
          padding: "0 12px",
          border: `1px solid ${palette.hairline}`,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "saturate(180%) blur(10px)",
          WebkitBackdropFilter: "saturate(180%) blur(10px)",
          color: palette.ink,
          fontSize: 12,
          fontWeight: 600,
          borderRadius: 999,
          cursor: "pointer",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          zIndex: 20,
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        Sign out
      </button>

      <nav
        role="tablist"
        aria-label="Primary"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          display: "grid",
          gridTemplateColumns: `repeat(${screens.length}, 1fr)`,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          borderTop: `1px solid ${palette.hairline}`,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          paddingTop: 4,
          zIndex: 30,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
        }}
      >
        {screens.map((tab) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab)}
              className="mobile-tap"
              style={{
                height: tabBarHeight - 4,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                background: "transparent",
                border: "none",
                color: active ? palette.accent : palette.subtle,
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                letterSpacing: 0.1,
                cursor: "pointer",
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
                padding: 0,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 30,
                  height: 30,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  lineHeight: 1,
                  borderRadius: 999,
                  background: active
                    ? "rgba(10,132,255,0.15)"
                    : "transparent",
                  color: active ? palette.accent : palette.subtle,
                  fontWeight: 700,
                  transition: "background 160ms ease, color 160ms ease",
                }}
              >
                {TAB_GLYPH[tab]}
              </span>
              <span>{tab}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}


function LoginForm({ onSession }: { onSession: (s: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: signInError } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    if (data.session) onSession(data.session);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        boxSizing: "border-box",
        padding: `calc(env(safe-area-inset-top, 0px) + 48px) 20px 48px`,
        background: `radial-gradient(120% 60% at 50% 0%, ${palette.accentSoft} 0%, ${palette.bg} 55%, ${palette.bgAlt} 100%)`,
        color: palette.ink,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, sans-serif',
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Brand mark */}
      <div
        aria-hidden="true"
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          background: gradient.primary,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 28,
          marginBottom: space.lg,
          boxShadow: shadow.primary,
          letterSpacing: -1,
        }}
      >
        SS
      </div>

      <h1
        style={{
          margin: "0 0 6px",
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: -0.8,
          textAlign: "center",
        }}
      >
        Welcome back
      </h1>
      <p
        style={{
          margin: `0 0 ${space.xl}px`,
          fontSize: 15,
          color: palette.muted,
          textAlign: "center",
        }}
      >
        Sign in to Shift Secure to continue
      </p>

      {/* Centered card */}
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: palette.surface,
          border: `1px solid ${palette.hairline}`,
          borderRadius: 24,
          padding: 22,
          boxShadow: "0 10px 30px rgba(20,24,28,0.08)",
        }}
      >
        <form onSubmit={handleSubmit} noValidate>
          <label style={labelStyle} htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <label style={labelStyle} htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ ...inputStyle, marginBottom: space.md }}
          />
          {error && <Banner tone="error">{error}</Banner>}
          <button
            type="submit"
            disabled={busy || !email || !password}
            className="mobile-tap"
            style={{
              ...primaryButton,
              width: "100%",
              minHeight: 52,
              fontSize: 16,
              marginTop: 4,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              borderRadius: radii.lg,
            }}
          >
            {busy ? (
              <>
                <Spinner size={16} color={palette.surface} />
                <span>Signing in…</span>
              </>
            ) : (
              "Sign in"
            )}
          </button>

          <div
            style={{
              textAlign: "center",
              marginTop: space.md,
              fontSize: 13,
              color: palette.muted,
            }}
          >
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              style={{ color: palette.accentDeep, fontWeight: 600, textDecoration: "none" }}
            >
              Forgot password?
            </a>
          </div>
        </form>
      </div>

      <p
        data-mobile-build={buildStamp}
        style={{
          margin: `${space.xl}px 0 0`,
          fontSize: 10,
          color: palette.subtle,
          textAlign: "center",
          letterSpacing: 0.4,
        }}
      >
        Shift Secure · Secure handoff
      </p>
    </main>
  );
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    sb.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        setReady(true);
      })
      .catch((err) => {
        reportBoot("getSession", err);
        if (mounted) setReady(true);
      });
    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return (
      <main
        style={{
          ...pageStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spinner label="Loading…" />
      </main>
    );
  }

  if (!session) {
    return <LoginForm onSession={setSession} />;
  }

  return (
    <MobileHome
      email={session.user.email ?? "unknown"}
      userId={session.user.id}
      onSignOut={() => {
        sb.auth.signOut().then(() => setSession(null));
      }}
    />
  );
}

class BootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportBoot("React render", `${error.stack ?? error.message}\n${info.componentStack ?? ""}`);
  }
  render() {
    if (this.state.error) {
      return (
        <main style={pageStyle}>
          <h1 style={{ fontSize: 20, margin: "0 0 12px" }}>Render error</h1>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: palette.critical }}>
            {this.state.error.stack ?? this.state.error.message}
          </pre>
        </main>
      );
    }
    return this.props.children;
  }
}

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    reportBoot("mount", "#root element not found in DOM");
  } else {
    ReactDOM.createRoot(rootElement).render(
      <BootErrorBoundary>
        <App />
      </BootErrorBoundary>,
    );
  }
} catch (err) {
  reportBoot("mount", err as Error);
}
