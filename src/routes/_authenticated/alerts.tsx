import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Info,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({ meta: [{ title: "Critical Alerts — ShiftSecure" }] }),
  component: AlertsPage,
});

type Severity = "info" | "warning" | "critical";
type Status = "active" | "acknowledged" | "resolved";

type AlertRow = {
  id: string;
  created_by: string;
  patient_ref: string;
  summary: string;
  severity: Severity;
  status: Status;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileLite = { id: string; full_name: string };

const SEVERITY_META: Record<
  Severity,
  { label: string; tone: string; ring: string; icon: typeof AlertTriangle }
> = {
  critical: {
    label: "Critical",
    tone: "bg-destructive text-destructive-foreground",
    ring: "border-destructive/60 bg-destructive/5",
    icon: ShieldAlert,
  },
  warning: {
    label: "Warning",
    tone: "bg-orange-500 text-white",
    ring: "border-orange-500/50 bg-orange-500/5",
    icon: AlertTriangle,
  },
  info: {
    label: "Info",
    tone: "bg-primary text-primary-foreground",
    ring: "border-primary/40 bg-primary/5",
    icon: Info,
  },
};

const STATUS_META: Record<Status, { label: string; tone: string }> = {
  active: { label: "Active", tone: "bg-destructive/15 text-destructive border-destructive/30" },
  acknowledged: {
    label: "Acknowledged",
    tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  resolved: {
    label: "Resolved",
    tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
};

function AlertsPage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | Status>("active");

  const profilesById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.id, p.full_name || "Unknown");
    return m;
  }, [profiles]);

  const load = useCallback(async () => {
    const [a, p] = await Promise.all([
      supabase.from("patient_alerts").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
    ]);
    if (a.error) toast.error(a.error.message);
    setAlerts((a.data ?? []) as AlertRow[]);
    setProfiles((p.data ?? []) as ProfileLite[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("patient_alerts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "patient_alerts" },
        (payload) => {
          setAlerts((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as AlertRow;
              if (prev.some((r) => r.id === row.id)) return prev;
              if (row.severity === "critical" && row.created_by !== user.id) {
                toast.error(`New critical alert: ${row.patient_ref}`, { description: row.summary });
              }
              return [row, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as AlertRow;
              return prev.map((r) => (r.id === row.id ? row : r));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as AlertRow;
              return prev.filter((r) => r.id !== row.id);
            }
            return prev;
          });
        },
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const visible = useMemo(
    () => (filter === "all" ? alerts : alerts.filter((a) => a.status === filter)),
    [alerts, filter],
  );

  const activeCriticalCount = useMemo(
    () => alerts.filter((a) => a.status === "active" && a.severity === "critical").length,
    [alerts],
  );

  async function acknowledge(row: AlertRow) {
    if (!user) return;
    const { error } = await supabase
      .from("patient_alerts")
      .update({
        status: "acknowledged",
        acknowledged_by: user.id,
        acknowledged_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) toast.error(error.message);
    else toast.success("Alert acknowledged");
  }

  async function resolve(row: AlertRow) {
    const { error } = await supabase
      .from("patient_alerts")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) toast.error(error.message);
    else toast.success("Alert resolved");
  }

  async function remove(row: AlertRow) {
    if (!confirm("Delete this alert?")) return;
    const { error } = await supabase.from("patient_alerts").delete().eq("id", row.id);
    if (error) toast.error(error.message);
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" /> Dashboard
              </Link>
            </Button>
            <div className="hidden sm:flex items-center gap-2 font-display font-bold">
              <BellRing className="h-5 w-5 text-destructive" />
              Critical Patient Alerts
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`flex items-center gap-1.5 text-xs ${connected ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
            >
              {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {connected ? "Live" : "Offline"}
            </span>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> New alert
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {activeCriticalCount > 0 && (
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">
              {activeCriticalCount} active critical {activeCriticalCount === 1 ? "alert" : "alerts"}{" "}
              requiring attention.
            </p>
          </div>
        )}

        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-wider text-muted-foreground">Patient safety</p>
            <h1 className="font-display text-3xl font-bold tracking-tight">Critical Alerts</h1>
            <p className="mt-1 text-muted-foreground">
              Broadcast high-priority patient concerns to the whole shift in real time.
            </p>
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : visible.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="mt-3 font-medium">No {filter === "all" ? "" : filter} alerts</p>
              <p className="text-sm text-muted-foreground">All clear for this view.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {visible.map((a) => {
              const meta = SEVERITY_META[a.severity];
              const Icon = meta.icon;
              const isCritical = a.severity === "critical" && a.status === "active";
              return (
                <Card
                  key={a.id}
                  className={`overflow-hidden border-l-4 ${meta.ring} ${isCritical ? "shadow-elegant animate-pulse-once" : ""}`}
                  style={isCritical ? { animation: "pulse 2s ease-in-out infinite" } : undefined}
                >
                  <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start">
                    <div
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${meta.tone}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={meta.tone}>{meta.label}</Badge>
                        <Badge variant="outline" className={STATUS_META[a.status].tone}>
                          {STATUS_META[a.status].label}
                        </Badge>
                        <span className="font-mono text-sm font-semibold">{a.patient_ref}</span>
                        <span className="text-xs text-muted-foreground">
                          · {new Date(a.created_at).toLocaleString()} · by{" "}
                          {profilesById.get(a.created_by) ?? "—"}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm">{a.summary}</p>
                      {a.acknowledged_by && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Acknowledged by {profilesById.get(a.acknowledged_by) ?? "—"}
                          {a.acknowledged_at
                            ? ` · ${new Date(a.acknowledged_at).toLocaleString()}`
                            : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {a.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => acknowledge(a)}>
                          Acknowledge
                        </Button>
                      )}
                      {a.status !== "resolved" && (
                        <Button size="sm" onClick={() => resolve(a)}>
                          Resolve
                        </Button>
                      )}
                      {a.created_by === user?.id && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => remove(a)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <NewAlertDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => {
          /* realtime will sync */
        }}
      />
    </div>
  );
}

function NewAlertDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [patientRef, setPatientRef] = useState("");
  const [summary, setSummary] = useState("");
  const [severity, setSeverity] = useState<Severity>("critical");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setPatientRef("");
      setSummary("");
      setSeverity("critical");
    }
  }, [open]);

  async function save() {
    if (!user) return;
    if (!patientRef.trim() || !summary.trim()) {
      toast.error("Patient reference and summary are required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("patient_alerts").insert({
      created_by: user.id,
      patient_ref: patientRef.trim(),
      summary: summary.trim(),
      severity,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Alert broadcast to the team");
    onCreated();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New patient alert</DialogTitle>
          <DialogDescription>
            All team members on shift will see this immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="patient">Patient reference</Label>
            <Input
              id="patient"
              placeholder="Bed 12 / MRN 8472"
              value={patientRef}
              onChange={(e) => setPatientRef(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="severity">Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as Severity)}>
              <SelectTrigger id="severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="summary">Summary</Label>
            <Textarea
              id="summary"
              rows={4}
              placeholder="What's happening, what's needed, time-sensitive details…"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Broadcast alert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
