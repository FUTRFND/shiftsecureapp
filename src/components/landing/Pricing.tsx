import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Resident",
    price: "Free",
    sub: "Forever for individuals",
    features: ["Up to 10 active handoffs", "Voice-to-text (5h/mo)", "Personal templates"],
    cta: "Start free",
    variant: "outline" as const,
  },
  {
    name: "Team",
    price: "$24",
    sub: "per user / month",
    features: ["Unlimited handoffs", "Shared templates & tasks", "Critical alerts (SMS + in-app)", "Audit trail"],
    cta: "Start 14-day trial",
    variant: "hero" as const,
    featured: true,
  },
  {
    name: "Department",
    price: "Custom",
    sub: "For hospitals & EDs",
    features: ["SSO + role management", "Department analytics", "EHR integration", "Dedicated success manager"],
    cta: "Contact sales",
    variant: "outline" as const,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 md:py-32 bg-gradient-subtle">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">Pricing</p>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight">Simple, per-clinician pricing.</h2>
        </div>
        <div className="mt-16 grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl border bg-card p-8 transition-all ${
                p.featured
                  ? "border-primary shadow-elegant md:-translate-y-2"
                  : "border-border shadow-card"
              }`}
            >
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-elegant">
                  Most popular
                </div>
              )}
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="font-display text-5xl font-bold">{p.price}</span>
              </div>
              <p className="text-sm text-muted-foreground">{p.sub}</p>
              <Button variant={p.variant} className="mt-6 w-full" size="lg">{p.cta}</Button>
              <ul className="mt-8 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-sm">
                    <Check className="h-5 w-5 text-primary shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
