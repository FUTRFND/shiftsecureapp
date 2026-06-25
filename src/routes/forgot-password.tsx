import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "./login";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AUTH_CALLBACK_PATH, buildAuthRedirectUrl, RESET_PASSWORD_ROUTE } from "@/config/auth";

const schema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
});

type Schema = z.infer<typeof schema>;

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — Shift Secure" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const emailValue = watch("email");
  const [sent, setSent] = useState(false);

  const onSubmit = async (data: Schema) => {
    // Web sends users to /reset-password directly; native funnels through the
    // custom-scheme callback so the deep-link handler routes them to the
    // reset-password screen after exchanging the recovery tokens.
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: buildAuthRedirectUrl(RESET_PASSWORD_ROUTE, AUTH_CALLBACK_PATH),
    });

    if (error) {
      setError("root", { message: error.message });
      return;
    }

    setSent(true);
    toast.success("Reset email sent");
  };

  return (
    <AuthShell title="Forgot password" subtitle="We'll email you a secure reset link">
      {sent ? (
        <div className="space-y-6">
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <AlertDescription>
              Check <span className="font-semibold">{emailValue}</span> for a reset link. If it
              doesn't appear, check your spam folder.
            </AlertDescription>
          </Alert>
          <Button asChild variant="outline" className="w-full">
            <Link to="/login">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {errors.root && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          )}
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
          <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
            Send reset link
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
