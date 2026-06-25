import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTA() {
  return (
    <section className="py-24 md:py-32">
      <div className="container mx-auto px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-12 md:p-20 text-center shadow-elegant">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, white, transparent 40%), radial-gradient(circle at 80% 80%, white, transparent 40%)",
            }}
          />
          <div className="relative">
            <h2 className="text-4xl md:text-5xl font-bold text-primary-foreground tracking-tight max-w-2xl mx-auto">
              Safer handoffs start on your next shift.
            </h2>
            <p className="mt-4 text-primary-foreground/80 text-lg max-w-xl mx-auto">
              Join the EDs replacing chaos with structure. Free for the first 30 days.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Button variant="secondary" size="xl">
                Get started <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
