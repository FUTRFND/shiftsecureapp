import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Stethoscope } from "lucide-react";
import heroImg from "@/assets/hero.jpg";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="container relative mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-primary pulse-ring" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Built for emergency medicine teams
          </div>
          <h1 className="mt-6 text-5xl md:text-7xl font-bold tracking-tight">
            Shift changes, <span className="text-gradient">without the gaps.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Structured handoffs, real-time task ownership, and critical alerts — so nothing falls
            through the cracks when the shift changes.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="hero" size="xl">
              Start free trial <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="xl">
              <Stethoscope className="h-4 w-4" /> Book a demo
            </Button>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            HIPAA-ready · SOC 2 in progress · No credit card required
          </div>
        </div>

        <div className="relative mx-auto mt-16 max-w-5xl">
          <div className="absolute -inset-4 bg-gradient-primary opacity-20 blur-3xl rounded-3xl" />
          <div className="relative rounded-2xl overflow-hidden border border-border shadow-elegant">
            <img
              src={heroImg}
              alt="ShiftSecure handoff dashboard"
              width={1536}
              height={1024}
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
