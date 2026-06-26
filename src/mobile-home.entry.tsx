// Native mobile entry: Supabase auth (login/session) only, then MobileHome.
// No router, no AuthProvider, no Toaster, no native-shell, no Capacitor plugins.
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { createClient, type Session, type User } from "@supabase/supabase-js";
import { AlertsScreen } from "./mobile/alerts";
import { TemplatesScreen } from "./mobile/templates";
import { TasksScreen } from "./mobile/tasks";
import { VoiceScreen } from "./mobile/voice";
import { HomeScreen } from "./mobile/home";
import { AccountScreen } from "./mobile/account";
import { hardSignOut } from "./mobile/auth-session";
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

const screens = ["Home", "Alerts", "Templates", "Tasks", "Voice", "Account"] as const;
type Screen = (typeof screens)[number];
type AuthDebug = {
  signedIn: boolean;
  session: boolean;
  userId: string | null;
  rootState: "signed in" | "signed out";
  currentAuthEvent: string;
  lastLogoutStep: string;
};

// Inline SVG icons matched to SF Symbols feel.
function TabIcon({ name, active }: { name: Screen; active: boolean }) {
  const stroke = active ? palette.accentDeep : palette.subtle;
  const fill = active ? palette.accent : "none";
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "Home":
      return (
        <svg {...common}>
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5 10.5V20h14V10.5" fill={active ? palette.accentSoft : "none"} />
        </svg>
      );
    case "Alerts":
      return (
        <svg {...common}>
          <path d="M6 17V11a6 6 0 1 1 12 0v6l1.5 2H4.5z" fill={active ? palette.accentSoft : "none"} />
          <path d="M10 21h4" />
        </svg>
      );
    case "Templates":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="3" fill={active ? palette.accentSoft : "none"} />
          <path d="M8 9h8M8 13h8M8 17h5" />
        </svg>
      );
    case "Tasks":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="4" fill={active ? palette.accentSoft : "none"} />
          <path d="m8 12 3 3 5-6" stroke={active ? palette.accentDeep : stroke} />
        </svg>
      );
    case "Voice":
      return (
        <svg {...common}>
          <rect x="9" y="3" width="6" height="12" rx="3" fill={active ? palette.accentSoft : "none"} />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      );
    case "Account":
      return (
        <svg {...common}>
          <circle cx="12" cy="8.5" r="3.5" fill={active ? palette.accentSoft : "none"} />
          <path d="M4.5 20c1.6-3.5 4.4-5 7.5-5s5.9 1.5 7.5 5" />
        </svg>
      );
  }
  // exhaustive
  const _: never = name;
  return _;
}

function MobileHome({
  email,
  userId,
  authDebug,
  onSignOut,
}: {
  email: string;
  userId: string;
  authDebug: AuthDebug;
  onSignOut: () => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<Screen>("Home");
  const goAlerts = () => setActiveTab("Alerts");

  const tabBarHeight = 72;
  const contentWrapStyle: React.CSSProperties = {
    paddingBottom: `calc(${tabBarHeight}px + 18px + env(safe-area-inset-bottom, 0px))`,
    minHeight: "100vh",
    background: palette.bg,
  };

  let screen: React.ReactNode = null;
  if (activeTab === "Home") {
    screen = (
      <HomeScreen
        sb={sb}
        userId={userId}
        email={email}
        onNavigate={(t) => setActiveTab(t)}
      />
    );
  } else if (activeTab === "Alerts") {
    screen = <AlertsScreen sb={sb} userId={userId} onBack={goAlerts} />;
  } else if (activeTab === "Templates") {
    screen = <TemplatesScreen sb={sb} userId={userId} onBack={goAlerts} />;
  } else if (activeTab === "Tasks") {
    screen = <TasksScreen sb={sb} userId={userId} onBack={goAlerts} />;
  } else if (activeTab === "Voice") {
    screen = <VoiceScreen sb={sb} userId={userId} onBack={goAlerts} />;
  } else if (activeTab === "Account") {
    screen = (
      <AccountScreen
        sb={sb}
        userId={userId}
        email={email}
        authDebug={authDebug}
        onSignOut={onSignOut}
      />
    );
  }

  return (
    <div data-mobile-build={buildStamp} style={{ position: "relative" }}>
      <div style={contentWrapStyle}>
        <ScreenFade k={activeTab}>{screen}</ScreenFade>
      </div>

      {/* Sign out moved to Account tab */}



      {/* Floating translucent tab bar */}
      <nav
        role="tablist"
        aria-label="Primary"
        style={{
          position: "fixed",
          left: 10,
          right: 10,
          bottom: `calc(env(safe-area-inset-bottom, 0px) + 10px)`,
          display: "grid",
          gridTemplateColumns: `repeat(${screens.length}, 1fr)`,
          background: "rgba(255,255,255,0.78)",
          backdropFilter: "saturate(180%) blur(24px)",
          WebkitBackdropFilter: "saturate(180%) blur(24px)",
          border: `1px solid rgba(255,255,255,0.7)`,
          borderRadius: 24,
          boxShadow:
            "0 10px 30px rgba(20,24,28,0.12), 0 2px 6px rgba(20,24,28,0.06)",
          paddingTop: 6,
          paddingBottom: 6,
          paddingLeft: 4,
          paddingRight: 4,
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
                height: tabBarHeight - 12,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                background: "transparent",
                border: "none",
                color: active ? palette.accentDeep : palette.subtle,
                fontSize: 10.5,
                fontWeight: active ? 700 : 500,
                letterSpacing: 0.1,
                cursor: "pointer",
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
                padding: 0,
                position: "relative",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 44,
                  height: 30,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 999,
                  background: active ? palette.accentSoft : "transparent",
                  transition: "background 180ms ease, transform 180ms ease",
                  transform: active ? "translateY(-1px)" : "translateY(0)",
                }}
              >
                <TabIcon name={tab} active={active} />
              </span>
              <span style={{ marginTop: 1 }}>{tab}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}



function LoginForm({ onSession }: { onSession: (s: Session) => void }) {
  useEffect(() => {
    console.log("[logout] Login screen rendered");
  }, []);

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
  const [user, setUser] = useState<User | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [currentAuthEvent, setCurrentAuthEvent] = useState("none");
  const [lastLogoutStep, setLastLogoutStep] = useState("none");

  const applySession = (next: Session | null) => {
    setSession(next);
    setUser(next?.user ?? null);
    setSignedIn(Boolean(next?.user));
  };

  useEffect(() => {
    let mounted = true;
    sb.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        console.log("[auth] session restored", data.session ? "present" : "none");
        setCurrentAuthEvent("initial getSession");
        applySession(data.session);
        setReady(true);
      })
      .catch((err) => {
        reportBoot("getSession", err);
        if (mounted) setReady(true);
      });
    const { data: sub } = sb.auth.onAuthStateChange((event, next) => {
      console.log("[logout] onAuthStateChange events received", {
        event,
        sessionPresent: Boolean(next),
        userId: next?.user?.id ?? null,
      });
      console.log("[auth] state change", event, next ? "session" : "null");
      setCurrentAuthEvent(event);
      if (event === "SIGNED_OUT") {
        applySession(null);
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        applySession(next);
      }
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

  if (!session || !user || !signedIn) {
    return <LoginForm onSession={applySession} />;
  }

  return (
    <MobileHome
      email={user.email ?? "unknown"}
      userId={user.id}
      authDebug={{
        signedIn,
        session: Boolean(session),
        userId: user?.id ?? null,
        rootState: signedIn ? "signed in" : "signed out",
        currentAuthEvent,
        lastLogoutStep,
      }}
      onSignOut={() =>
        hardSignOut({
          supabase: sb,
          setSession,
          setUser,
          setSignedIn,
          onLogoutStep: setLastLogoutStep,
        })
      }
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
