const steps = [
  { n: "01", title: "Open the template", body: "Pick a structured handoff template tuned to your department." },
  { n: "02", title: "Dictate or type", body: "Voice-to-text fills the right fields — patients, plans, pending tasks." },
  { n: "03", title: "Assign & hand off", body: "Tasks transfer with ownership. Alerts notify the next shift instantly." },
];

export function Workflow() {
  return (
    <section id="workflow" className="py-24 md:py-32">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-sm font-semibold text-primary uppercase tracking-wider">How it works</p>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight">
            A handoff in under two minutes.
          </h2>
        </div>
        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {steps.map((s, i) => (
            <div key={s.n} className="relative">
              <div className="rounded-2xl border border-border bg-card p-8 shadow-card h-full">
                <div className="font-display text-5xl font-bold text-gradient">{s.n}</div>
                <h3 className="mt-4 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-muted-foreground">{s.body}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-3 h-px w-6 bg-border" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
