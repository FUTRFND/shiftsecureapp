import { createFileRoute } from "@tanstack/react-router";
import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { Features } from "@/components/landing/Features";
import { Workflow } from "@/components/landing/Workflow";
import { Pricing } from "@/components/landing/Pricing";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ShiftSecure — Safer emergency medicine handoffs" },
      {
        name: "description",
        content:
          "Structured handoff templates, real-time task ownership, and critical alerts for emergency medicine teams. Eliminate information loss at shift change.",
      },
      { property: "og:title", content: "ShiftSecure — Safer ED handoffs" },
      { property: "og:description", content: "Structured handoffs and real-time tasks for emergency medicine teams." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-dvh bg-background">
      <Nav />
      <main>
        <Hero />
        <Features />
        <Workflow />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
