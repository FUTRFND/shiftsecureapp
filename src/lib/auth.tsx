import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthStorage, hydrateAuthStorage } from "@/platform/storage";
import { startDeepLinkListener } from "@/platform/deep-links";
import { registerAuthDeepLinkHandler } from "@/lib/auth-deep-link";
import { SIGN_IN_ROUTE } from "@/config/auth";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Guard against duplicate concurrent boot — strict mode double-invokes effects.
  const bootRef = useRef(false);

  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;

    let unsubAuth: (() => void) | undefined;
    let unsubDeepLink: (() => void) | undefined;
    let stopNativeListener: (() => Promise<void>) | undefined;
    let cancelled = false;

    (async () => {
      // 1. Hydrate native Preferences → sync storage cache BEFORE the Supabase
      //    client makes its first auth read. On web this is a no-op.
      try {
        await hydrateAuthStorage();
      } catch (err) {
        console.warn("[auth] hydrateAuthStorage failed", err);
      }
      if (cancelled) return;

      // 2. Register the deep-link handler (works on web too — covers Universal
      //    Links opened in-app). This is independent from the listener below.
      unsubDeepLink = registerAuthDeepLinkHandler({
        navigate: router.navigate as never,
        onError: (message) => toast.error(message),
      });

      // 3. Start the native Capacitor URL listener. No-op on web.
      try {
        stopNativeListener = await startDeepLinkListener();
      } catch (err) {
        console.warn("[auth] startDeepLinkListener failed", err);
      }
      if (cancelled) return;

      // 4. Subscribe to auth state changes BEFORE getSession() so we never
      //    miss a transition fired during boot.
      const { data: subData } = supabase.auth.onAuthStateChange((event, newSession) => {
        setSession(newSession);
        setLoading(false);
        if (event === "TOKEN_REFRESHED") {
          // Persisted by the storage adapter automatically; nothing else to do.
        }
      });
      unsubAuth = () => subData.subscription.unsubscribe();

      // 5. Restore persisted session.
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn("[auth] getSession error", error);
        }
        if (!cancelled) {
          setSession(data.session);
          setLoading(false);
        }
      } catch (err) {
        console.error("[auth] getSession threw", err);
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubAuth?.();
      unsubDeepLink?.();
      void stopNativeListener?.();
    };
    // Router is stable for the app lifetime; we only want this to run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    // Sign-Out Hygiene: cancel in-flight queries, sign out, wipe storage,
    // navigate to the public sign-in route with history replace.
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("[auth] signOut error", err);
    }
    try {
      await clearAuthStorage();
    } catch (err) {
      console.warn("[auth] clearAuthStorage error", err);
    }
    setSession(null);
    await router.navigate({ to: SIGN_IN_ROUTE, replace: true });
  };

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
