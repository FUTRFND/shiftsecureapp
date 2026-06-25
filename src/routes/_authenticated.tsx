import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

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
  return (
    <div className="min-h-dvh bg-background safe-top safe-x">
      <Outlet />
    </div>
  );
}
