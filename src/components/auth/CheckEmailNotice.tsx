import { useEffect, useState } from "react";
import { MailCheck, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; cooldown: number }
  | { kind: "error"; message: string };

export function CheckEmailNotice({ email }: { email: string }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  useEffect(() => {
    if (status.kind !== "sent" || status.cooldown <= 0) return;
    const t = setTimeout(
      () => setStatus({ kind: "sent", cooldown: status.cooldown - 1 }),
      1000,
    );
    return () => clearTimeout(t);
  }, [status]);

  const handleResend = async () => {
    setStatus({ kind: "sending" });
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setStatus({ kind: "error", message: error.message });
      return;
    }
    setStatus({ kind: "sent", cooldown: 30 });
  };

  const sending = status.kind === "sending";
  const cooldown = status.kind === "sent" ? status.cooldown : 0;

  return (
    <div className="text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
        <MailCheck className="h-7 w-7" />
      </div>
      <h2 className="mt-4 font-display text-xl font-semibold tracking-tight">
        Confirm your email
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        We sent a confirmation link to{" "}
        <span className="font-medium text-foreground">{email}</span>. Click the
        link in that email to activate your account.
      </p>

      {status.kind === "sent" && (
        <Alert className="mt-5 text-left border-primary/30 bg-primary/5">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <AlertDescription>
            Confirmation email sent. Check your inbox (and spam folder).
          </AlertDescription>
        </Alert>
      )}
      {status.kind === "error" && (
        <Alert variant="destructive" className="mt-5 text-left">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      )}

      <div className="mt-6 space-y-3">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleResend}
          disabled={sending || cooldown > 0}
        >
          {sending && <Loader2 className="animate-spin h-4 w-4 mr-2" />}
          {cooldown > 0
            ? `Resend in ${cooldown}s`
            : sending
              ? "Sending…"
              : "Resend confirmation email"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Already confirmed?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
