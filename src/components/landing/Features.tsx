import { ClipboardList, ListTodo, BellRing, Mic, LineChart, ShieldCheck } from "lucide-react";

const features = [
  {
    icon: ClipboardList,
    title: "Structured handoff templates",
    body: "Evidence-based templates ensure every critical data point is captured — customizable per specialty.",
  },
  {
    icon: ListTodo,
    title: "Real-time task ownership",
    body: "Shared task lists with clear assignment, due times, and live status across the team.",
  },
  {
    icon: BellRing,
    title: "Critical patient alerts",
    body: "Configurable in-app and SMS alerts the moment labs, imaging, or vitals shift.",
  },
  {
    icon: Mic,
    title: "Voice-to-text summaries",
    body: "Dictate handoff notes; we transcribe them into structured fields automatically.",
  },
  {
    icon: LineChart,
    title: "Audit trail & analytics",
    body: "Immutable logs and dashboards for QI initiatives, compliance, and incident review.",
  },
  {
    icon: ShieldCheck,
    title: "Built for safety",
    body: "Role-based access, end-to-end encryption, and HIPAA-aligned controls by default.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 md:py-32 bg-gradient-subtle">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">The platform</p>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight">
            Every detail of the handoff, accounted for.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Five connected workflows that replace fragmented notes, sticky pads, and verbal-only handoffs.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="group relative rounded-2xl border border-border bg-card p-7 shadow-card hover:shadow-elegant hover:-translate-y-1 transition-all duration-300"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant group-hover:scale-110 transition-transform">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
