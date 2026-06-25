// Native mobile entry: Supabase auth (login/session) only, then MobileHome.
// No router, no AuthProvider, no Toaster, no native-shell, no Capacitor plugins.
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { createClient, type Session } from "@supabase/supabase-js";
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
  onSignOut,
}: {
  email: string;
  onSignOut: () => void;
}) {
  const [activeScreen, setActiveScreen] = useState<Screen>("Alerts");

  return (
    <main style={pageStyle}>
      <h1 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 700 }}>
        Shift Secure
      </h1>
      <p style={{ margin: "0 0 24px", fontSize: 14, color: palette.muted }}>
        Signed in as {email}
      </p>
      <p
        data-mobile-build={buildStamp}
        style={{ margin: "0 0 20px", fontSize: 11, color: "#888" }}
      >
        {buildStamp}
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        {screens.map((screen) => (
          <button
            key={screen}
            type="button"
            onClick={() => setActiveScreen(screen)}
            style={{
              width: "100%",
              minHeight: 56,
              border: `1px solid ${palette.border}`,
              borderRadius: 0,
              background:
                activeScreen === screen ? palette.ink : palette.surface,
              color: activeScreen === screen ? palette.surface : palette.ink,
              font: "inherit",
              fontSize: 18,
              fontWeight: 600,
              textAlign: "left",
              padding: "0 18px",
            }}
          >
            {screen}
          </button>
        ))}
      </div>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 600 }}>
          {activeScreen}
        </h2>
        <p style={{ margin: 0, fontSize: 16, color: palette.muted }}>
          {activeScreen} content coming soon.
        </p>
      </section>

      <button
        type="button"
        onClick={onSignOut}
        style={{
          marginTop: 40,
          width: "100%",
          minHeight: 48,
          border: `1px solid ${palette.border}`,
          background: palette.surface,
          color: palette.ink,
          fontSize: 16,
          fontWeight: 600,
        }}
      >
        Sign out
      </button>
    </main>
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

