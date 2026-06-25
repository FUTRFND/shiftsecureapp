// Native mobile entry: Supabase auth (login/session) only, then MobileHome.
// No router, no AuthProvider, no Toaster, no native-shell, no Capacitor plugins.
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { createClient, type Session } from "@supabase/supabase-js";
import { AlertsScreen } from "./mobile/alerts";
import { TemplatesScreen } from "./mobile/templates";
import { TasksScreen } from "./mobile/tasks";
import { VoiceScreen } from "./mobile/voice";
import { ScreenFade } from "./mobile/ui";
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

const palette = {
  bg: "#f7f7f2",
  ink: "#121212",
  muted: "#454545",
  border: "#121212",
  surface: "#ffffff",
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  boxSizing: "border-box",
  padding: "48px 20px",
  background: palette.bg,
  color: palette.ink,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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

  const tabBarHeight = 64;
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
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 0px) + 12px)",
          right: 12,
          minHeight: 32,
          padding: "0 10px",
          border: `1px solid ${palette.border}`,
          background: "rgba(255,255,255,0.9)",
          color: palette.ink,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          zIndex: 20,
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
          background: palette.surface,
          borderTop: `1px solid ${palette.border}`,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          zIndex: 30,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
              style={{
                height: tabBarHeight,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                background: "transparent",
                border: "none",
                borderTop: active
                  ? `2px solid ${palette.ink}`
                  : "2px solid transparent",
                color: active ? palette.ink : palette.muted,
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                touchAction: "manipulation",
                WebkitTapHighlightColor: "transparent",
                padding: 0,
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>
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

const TAB_GLYPH: Record<Screen, string> = {
  Alerts: "!",
  Templates: "▤",
  Tasks: "✓",
  Voice: "🎙",
};


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

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 48,
    padding: "0 14px",
    fontSize: 16,
    border: `1px solid ${palette.border}`,
    borderRadius: 0,
    background: palette.surface,
    color: palette.ink,
    marginBottom: 12,
  };

  return (
    <main style={pageStyle}>
      <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 700 }}>
        Shift Secure
      </h1>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: palette.muted }}>
        Sign in to continue
      </p>
      <p
        data-mobile-build={buildStamp}
        style={{ margin: "0 0 20px", fontSize: 11, color: "#888" }}
      >
        {buildStamp}
      </p>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
        />
        {error && (
          <p style={{ color: "#b00020", fontSize: 14, margin: "0 0 12px" }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          style={{
            width: "100%",
            minHeight: 52,
            border: `1px solid ${palette.border}`,
            background: palette.ink,
            color: palette.surface,
            fontSize: 17,
            fontWeight: 600,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
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
      <main style={pageStyle}>
        <p style={{ fontSize: 16 }}>Loading…</p>
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
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#b00020" }}>
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

