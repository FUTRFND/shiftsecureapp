import { Activity } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border py-12">
      <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-display font-bold">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-primary text-primary-foreground">
            <Activity className="h-3.5 w-3.5" strokeWidth={2.5} />
          </div>
          ShiftSecure
        </div>
        <p className="text-sm text-muted-foreground">© 2026 ShiftSecure. Built for the people who keep us alive.</p>
      </div>
    </footer>
  );
}
