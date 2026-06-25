// Native Alerts screen — local state, plain HTML, Supabase realtime.
// No shadcn, no sonner, no lucide, no router.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Banner,
  EmptyState,
  LoadingBlock,
  ScreenHeader,
  Spinner,
  buttonBase,
  ghostButton,
  inputStyle,
  pageStyle,
  palette,
  primaryButton,
  radii,
  space,
  useConfirm,
  useKeyboardScrollIntoView,
  usePullToRefresh,
} from "./ui";

type Severity = "info" | "warning" | "critical";
type Status = "active" | "acknowledged" | "resolved";

export type AlertRow = {
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

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: palette.critical,
  warning: palette.warning,
  info: palette.info,
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
};

const STATUS_LABEL: Record<Status, string> = {
  active: "Active",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
};


export function AlertsScreen({
  sb,
  userId,
  onBack,
}: {
  sb: SupabaseClient;
  userId: string;
  onBack: () => void;
}) {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState<"all" | Status>("active");
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  const profilesById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.id, p.full_name || "Unknown");
    return m;
  }, [profiles]);

  const load = useCallback(async () => {
    setError(null);
    const [a, p] = await Promise.all([
      sb
        .from("patient_alerts")
        .select("*")
        .order("created_at", { ascending: false }),
      sb.from("profiles").select("id, full_name"),
    ]);
    if (a.error) setError(a.error.message);
    setAlerts((a.data ?? []) as AlertRow[]);
    setProfiles((p.data ?? []) as ProfileLite[]);
    setLoading(false);
  }, [sb]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = sb
      .channel("patient_alerts-mobile")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "patient_alerts" },
        (payload) => {
          setAlerts((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as AlertRow;
              if (prev.some((r) => r.id === row.id)) return prev;
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
      sb.removeChannel(channel);
    };
  }, [sb]);

  const visible = useMemo(
    () =>
      filter === "all" ? alerts : alerts.filter((a) => a.status === filter),
    [alerts, filter],
  );

  const activeCritical = useMemo(
    () =>
      alerts.filter((a) => a.status === "active" && a.severity === "critical")
        .length,
    [alerts],
  );

  useKeyboardScrollIntoView();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { refreshing, indicator } = usePullToRefresh(load);

  async function acknowledge(row: AlertRow) {
    const ok = await confirm({
      title: "Acknowledge alert?",
      body: "Your name will be recorded as the acknowledger.",
      confirmLabel: "Acknowledge",
    });
    if (!ok) return;
    const { error: e } = await sb
      .from("patient_alerts")
      .update({
        status: "acknowledged",
        acknowledged_by: userId,
        acknowledged_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (e) setError(e.message);
  }

  async function resolve(row: AlertRow) {
    const ok = await confirm({
      title: "Resolve alert?",
      body: "Mark this alert as resolved for the whole shift.",
      confirmLabel: "Resolve",
    });
    if (!ok) return;
    const { error: e } = await sb
      .from("patient_alerts")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (e) setError(e.message);
  }

  async function remove(row: AlertRow) {
    const ok = await confirm({
      title: "Delete this alert?",
      body: "This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const { error: e } = await sb
      .from("patient_alerts")
      .delete()
      .eq("id", row.id);
    if (e) setError(e.message);
  }

  return (
    <main style={pageStyle}>
      {indicator}
      <ScreenHeader
        title="Alerts"
        subtitle="Broadcast high-priority patient concerns to the whole shift."
        right={
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: connected ? palette.ok : palette.subtle,
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: 999,
              background: connected ? "rgba(10,122,59,0.08)" : palette.surfaceAlt,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: connected ? palette.ok : palette.subtle,
              }}
            />
            {connected ? "Live" : "Offline"}
          </span>
        }
      />

      {activeCritical > 0 && (
        <Banner tone="error">
          {activeCritical} active critical{" "}
          {activeCritical === 1 ? "alert" : "alerts"} requiring attention.
        </Banner>
      )}

      {error && (
        <Banner tone="error" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}


      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 6,
          marginBottom: space.md,
        }}
      >
        {(["active", "acknowledged", "resolved", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className="mobile-tap"
            style={{
              ...buttonBase,
              minHeight: 36,
              padding: "0 4px",
              fontSize: 12,
              background: filter === f ? palette.ink : palette.surface,
              color: filter === f ? palette.surface : palette.ink,
            }}
          >
            {f === "all" ? "All" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setComposerOpen((v) => !v)}
        className="mobile-tap"
        style={{ ...primaryButton, width: "100%", marginBottom: space.md }}
      >
        {composerOpen ? "Cancel new alert" : "+ New alert"}
      </button>

      {composerOpen && (
        <NewAlertComposer
          sb={sb}
          userId={userId}
          onError={setError}
          onDone={() => setComposerOpen(false)}
        />
      )}

      {loading && !refreshing ? (
        <LoadingBlock label="Loading alerts…" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="◎"
          title={`No ${filter === "all" ? "" : STATUS_LABEL[filter].toLowerCase() + " "}alerts`}
          body="Pull down to refresh, or broadcast a new alert above."
        />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {visible.map((a) => (
            <AlertCard
              key={a.id}
              row={a}
              authorName={profilesById.get(a.created_by) ?? "—"}
              ackName={
                a.acknowledged_by
                  ? (profilesById.get(a.acknowledged_by) ?? "—")
                  : null
              }
              isMine={a.created_by === userId}
              onAcknowledge={() => acknowledge(a)}
              onResolve={() => resolve(a)}
              onDelete={() => remove(a)}
            />
          ))}
        </div>
      )}
      {confirmDialog}
    </main>
  );
}


function AlertCard({
  row,
  authorName,
  ackName,
  isMine,
  onAcknowledge,
  onResolve,
  onDelete,
}: {
  row: AlertRow;
  authorName: string;
  ackName: string | null;
  isMine: boolean;
  onAcknowledge: () => void;
  onResolve: () => void;
  onDelete: () => void;
}) {
  const tone = SEVERITY_COLOR[row.severity];
  return (
    <article
      style={{
        background: palette.surface,
        border: `1px solid ${palette.hairline}`,
        borderLeft: `4px solid ${tone}`,
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            background: tone,
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            padding: "2px 8px",
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {SEVERITY_LABEL[row.severity]}
        </span>
        <span
          style={{
            border: `1px solid ${palette.border}`,
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 8px",
            textTransform: "uppercase",
            letterSpacing: 0.4,
          }}
        >
          {STATUS_LABEL[row.status]}
        </span>
        <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 700, fontSize: 14 }}>
          {row.patient_ref}
        </span>
      </div>
      <p
        style={{
          margin: "4px 0 8px",
          fontSize: 15,
          whiteSpace: "pre-wrap",
          lineHeight: 1.35,
        }}
      >
        {row.summary}
      </p>
      <p style={{ margin: "0 0 10px", fontSize: 11, color: palette.muted }}>
        {new Date(row.created_at).toLocaleString()} · by {authorName}
        {ackName && ` · ack by ${ackName}`}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {row.status === "active" && (
          <button type="button" style={buttonBase} onClick={onAcknowledge}>
            Acknowledge
          </button>
        )}
        {row.status !== "resolved" && (
          <button type="button" style={primaryButton} onClick={onResolve}>
            Resolve
          </button>
        )}
        {isMine && (
          <button
            type="button"
            style={{ ...buttonBase, color: palette.critical }}
            onClick={onDelete}
            aria-label="Delete alert"
          >
            Delete
          </button>
        )}
      </div>
    </article>
  );
}

function NewAlertComposer({
  sb,
  userId,
  onDone,
  onError,
}: {
  sb: SupabaseClient;
  userId: string;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [patientRef, setPatientRef] = useState("");
  const [summary, setSummary] = useState("");
  const [severity, setSeverity] = useState<Severity>("critical");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!patientRef.trim() || !summary.trim()) {
      onError("Patient reference and summary are required");
      return;
    }
    setSaving(true);
    const { error } = await sb.from("patient_alerts").insert({
      created_by: userId,
      patient_ref: patientRef.trim(),
      summary: summary.trim(),
      severity,
    });
    setSaving(false);
    if (error) {
      onError(error.message);
      return;
    }
    setPatientRef("");
    setSummary("");
    setSeverity("critical");
    onDone();
  }

  return (
    <section
      style={{
        background: palette.surface,
        border: `1px solid ${palette.hairline}`,
        borderRadius: 12,
        padding: 14,
        marginBottom: 14,
      }}
    >
      <h2 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 700 }}>
        New patient alert
      </h2>
      <input
        type="text"
        placeholder="Patient reference (e.g. Bed 12 / MRN 8472)"
        value={patientRef}
        onChange={(e) => setPatientRef(e.target.value)}
        style={inputStyle}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 6,
          marginBottom: 10,
        }}
      >
        {(["critical", "warning", "info"] as Severity[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSeverity(s)}
            style={{
              ...buttonBase,
              minHeight: 40,
              fontSize: 13,
              background: severity === s ? SEVERITY_COLOR[s] : palette.surface,
              color: severity === s ? "#fff" : palette.ink,
              borderColor: severity === s ? SEVERITY_COLOR[s] : palette.border,
            }}
          >
            {SEVERITY_LABEL[s]}
          </button>
        ))}
      </div>
      <textarea
        rows={4}
        placeholder="What's happening, what's needed, time-sensitive details…"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        style={{ ...inputStyle, minHeight: 96, paddingTop: 10 }}
      />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mobile-tap"
        style={{
          ...primaryButton,
          width: "100%",
          opacity: saving ? 0.6 : 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        {saving && <Spinner size={14} color={palette.surface} />}
        {saving ? "Broadcasting…" : "Broadcast alert"}
      </button>
    </section>
  );
}
