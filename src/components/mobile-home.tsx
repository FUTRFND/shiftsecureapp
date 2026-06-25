import { useState } from "react";
import { Bell, FileText, ListChecks, Mic, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";

type Section = "alerts" | "templates" | "tasks" | "voice";

const SECTIONS: Array<{
  id: Section;
  title: string;
  description: string;
  icon: typeof Bell;
  placeholder: string;
}> = [
  {
    id: "alerts",
    title: "Alerts",
    description: "Critical handoff notifications",
    icon: Bell,
    placeholder: "Alerts will appear here once the mobile alerts view is wired up.",
  },
  {
    id: "templates",
    title: "Templates",
    description: "Reusable handoff structures",
    icon: FileText,
    placeholder: "Your shift templates will live here.",
  },
  {
    id: "tasks",
    title: "Tasks",
    description: "Open and pending follow-ups",
    icon: ListChecks,
    placeholder: "Tasks assigned to you will appear here.",
  },
  {
    id: "voice",
    title: "Voice",
    description: "Dictate a new handoff",
    icon: Mic,
    placeholder: "The native voice capture screen will load here.",
  },
];

export function MobileHome() {
  const { signOut } = useAuth();
  const [active, setActive] = useState<Section | null>(null);

  const activeSection = SECTIONS.find((s) => s.id === active) ?? null;

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="px-5 pt-4 pb-3 border-b border-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Shift Secure</h1>
          <p className="text-xs text-muted-foreground">Mobile preview</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void signOut();
          }}
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <main className="flex-1 px-5 py-5 space-y-4 safe-bottom">
        {activeSection ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <activeSection.icon className="h-5 w-5" />
                {activeSection.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{activeSection.placeholder}</p>
              <Button variant="outline" onClick={() => setActive(null)}>
                Back
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActive(s.id)}
                  className="text-left rounded-xl border border-border bg-card p-4 active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{s.title}</div>
                      <div className="text-xs text-muted-foreground">{s.description}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
