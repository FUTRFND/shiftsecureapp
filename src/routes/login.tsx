import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Activity, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { CheckEmailNotice } from "@/components/auth/CheckEmailNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isNative } from "@/platform/runtime";

const schema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  password: z.string().min(1, "Please enter your password"),
});

type Schema = z.infer<typeof schema>;

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Shift Secure" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (!authLoading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, authLoading, navigate]);

  const onSubmit = async (data: Schema) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      const isUnconfirmed =
        error.message.toLowerCase().includes("not confirmed") ||
        (error as { code?: string }).code === "email_not_confirmed";
      if (isUnconfirmed) {
        setUnconfirmedEmail(data.email);
        return;
      }
      setError("root", { message: error.message });
      return;
    }
    toast.success("Welcome back");
  };

  const handleGoogle = async () => {
    if (isNative()) {
      // Lovable's web_message OAuth flow doesn't work inside Capacitor's
      // WebView. Native Google Sign-In ships in a later phase via
      // @codetrix-studio/capacitor-google-auth or the RevenueCat-aligned
      // provider. Email/password remains fully available.
      setError("root", {
        message:
          "Google sign-in isn't available in the mobile app yet — please use email and password.",
      });
      return;
    }
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setError("root", { message: result.error.message ?? "Google sign-in failed" });
    }
  };

  if (unconfirmedEmail) {
    return (
      <AuthShell title="Confirm your email" subtitle="Your account isn't activated yet">
        <CheckEmailNotice email={unconfirmedEmail} />
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setUnconfirmedEmail(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back to sign in
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to continue to Shift Secure">
      {errors.root && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errors.root.message}</AlertDescription>
        </Alert>
      )}
      {!isNative() && (
        <>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogle}
            disabled={isSubmitting}
          >
            Continue with Google
          </Button>
          <div className="relative my-5 text-center text-xs uppercase tracking-wider text-muted-foreground">
            <span className="bg-background px-3 relative z-10">or</span>
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
          </div>
        </>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@hospital.org"
            aria-invalid={errors.email ? "true" : "false"}
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm font-medium text-destructive">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            aria-invalid={errors.password ? "true" : "false"}
            {...register("password")}
          />
          {errors.password && (
            <p className="text-sm font-medium text-destructive">{errors.password.message}</p>
          )}
        </div>
        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to Shift Secure?{" "}
        <Link to="/signup" className="text-primary font-medium hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-gradient-hero flex flex-col">
      <header className="container mx-auto px-6 py-6">
        <Link to="/" className="inline-flex items-center gap-2 font-display font-bold text-lg">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary text-primary-foreground shadow-elegant">
            <Activity className="h-4 w-4" strokeWidth={2.5} />
          </div>
          Shift Secure
        </Link>
      </header>
      <main className="flex-1 grid place-items-center px-6 pb-12">
        <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl p-8 shadow-elegant">
          <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
