import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, BellRing, ClipboardList, LogOut, Mic, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Shift Secure" }] }),
  component: Dashboard,
});

interface Profile {
  full_name: string;
  department: string;
}

function Dashboard() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, department")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data));
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setRole(data?.role ?? null));
  }, [user]);

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2 font-display font-bold text-lg">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elegant">
              <Activity className="h-4 w-4" strokeWidth={2.5} />
            </div>
            Shift Secure
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10">
        <div className="mb-10">
          <p className="text-sm uppercase tracking-wider text-muted-foreground">Welcome back</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
            {profile?.full_name || user?.email}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {[role, profile?.department].filter(Boolean).join(" · ") ||
              "Set up your profile to get started"}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DashCard
            to="/alerts"
            icon={BellRing}
            title="Critical alerts"
            description="Broadcast high-priority patient alerts to the whole shift in real time."
            cta="Open alerts"
          />
          <DashCard
            to="/templates"
            icon={ClipboardList}
            title="Handoff templates"
            description="Open or create a structured handoff template for your shift."
            cta="Open templates"
          />
          <DashCard
            to="/tasks"
            icon={Users}
            title="Team & tasks"
            description="Assign tasks with clear ownership. Updates sync live across the shift."
            cta="Open tasks"
          />
          <DashCard
            to="/voice"
            icon={Mic}
            title="Voice summary"
            description="Dictate a handoff and get a clean, structured SBAR summary."
            cta="Start dictation"
          />
        </div>
      </main>
    </div>
  );
}

function DashCard({
  icon: Icon,
  title,
  description,
  to,
  cta,
}: {
  icon: typeof Activity;
  title: string;
  description: string;
  to?: "/templates" | "/tasks" | "/alerts" | "/voice";
  cta?: string;
}) {
  return (
    <Card className="shadow-card hover:shadow-elegant transition-shadow">
      <CardHeader>
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elegant">
          <Icon className="h-5 w-5" />
        </div>
        <CardTitle className="mt-3">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {to ? (
          <Button asChild variant="outline" size="sm">
            <Link to={to}>{cta ?? "Open"}</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Coming soon
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
