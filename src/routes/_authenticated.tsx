import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { isNative } from "@/platform/runtime";
import { MobileHome } from "@/components/mobile-home";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background safe-y safe-x">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // safe-x covers landscape notches on iPhone Pro; safe-top reserves room
  // for the translucent status bar on native. On web all paddings are 0.
  // Inside Capacitor, short-circuit the web dashboard/feature routes and
  // render a minimal mobile shell with local-state cards. This avoids the
  // freeze caused by web route navigation inside the native WebView.
  if (isNative()) {
    return (
      <div className="min-h-dvh bg-background safe-top safe-x">
        <MobileHome />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background safe-top safe-x">
      <Outlet />
    </div>
  );
}
