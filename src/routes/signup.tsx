import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { AuthShell } from "./login";
import { CheckEmailNotice } from "@/components/auth/CheckEmailNotice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { isNative } from "@/platform/runtime";
import { buildAuthRedirectUrl, POST_AUTH_REDIRECT_PATH } from "@/config/auth";

const schema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Please enter your full name")
    .max(100, "Name must be 100 characters or less"),
  email: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(255, "Email must be 255 characters or less"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be 72 characters or less"),
  role: z.enum(["resident", "attending", "nurse", "admin"], { message: "Please select a role" }),
  department: z
    .string()
    .trim()
    .min(2, "Please enter your department")
    .max(100, "Department must be 100 characters or less"),
});

type Schema = z.infer<typeof schema>;

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create account — ShiftSecure" }] }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Schema>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: "", email: "", password: "", role: "resident", department: "" },
  });

  useEffect(() => {
    if (!authLoading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, authLoading, navigate]);

  const onSubmit = async (data: Schema) => {
    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: buildAuthRedirectUrl(POST_AUTH_REDIRECT_PATH),
        data: {
          full_name: data.fullName,
          role: data.role,
          department: data.department,
        },
      },
    });

    if (error) {
      setError("root", { message: error.message });
      return;
    }

    // If session is null, email confirmation is required
    if (!result.session) {
      setSubmittedEmail(data.email);
      return;
    }

    navigate({ to: "/dashboard", replace: true });
  };

  const handleGoogle = async () => {
    if (isNative()) {
      setError("root", {
        message:
          "Google sign-in isn't available in the mobile app yet — please create an account with email and password.",
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

  const roleValue = watch("role");

  if (submittedEmail) {
    return (
      <AuthShell title="One last step" subtitle="Verify your email to activate your account">
        <CheckEmailNotice email={submittedEmail} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" subtitle="Start safer shift handoffs in minutes">
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
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            placeholder="Jane Doe"
            aria-invalid={errors.fullName ? "true" : "false"}
            {...register("fullName")}
          />
          {errors.fullName && (
            <p className="text-sm font-medium text-destructive">{errors.fullName.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
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
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="At least 8 characters"
            aria-invalid={errors.password ? "true" : "false"}
            {...register("password")}
          />
          {errors.password && (
            <p className="text-sm font-medium text-destructive">{errors.password.message}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={roleValue}
              onValueChange={(v) => setValue("role", v as Schema["role"], { shouldValidate: true })}
            >
              <SelectTrigger id="role" aria-invalid={errors.role ? "true" : "false"}>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="resident">Resident</SelectItem>
                <SelectItem value="attending">Attending</SelectItem>
                <SelectItem value="nurse">Nurse</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-sm font-medium text-destructive">{errors.role.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              placeholder="Emergency"
              aria-invalid={errors.department ? "true" : "false"}
              {...register("department")}
            />
            {errors.department && (
              <p className="text-sm font-medium text-destructive">{errors.department.message}</p>
            )}
          </div>
        </div>
        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="text-primary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
