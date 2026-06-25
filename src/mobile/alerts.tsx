// Native Alerts screen — local state, plain HTML, Supabase realtime.
// No shadcn, no sonner, no lucide, no router.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  Banner,
  Card,
  Chip,
  EmptyState,
  FAB,
  Pill,
  ScreenHeader,
  SkeletonCard,
  Spinner,
  accentButton,
  buttonBase,
  dangerButton,
  ghostButton,
  inputStyle,
  pageStyle,
  palette,
  primaryButton,
  radii,
  shadow,
  space,
  textareaStyle,
  type,
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

const SEVERITY_SOFT: Record<Severity, string> = {
  critical: palette.criticalSoft,
  warning: palette.warningSoft,
  info: palette.infoSoft,
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

const STATUS_TONE: Record<
  Status,
  "critical" | "warning" | "success"
> = {
  active: "critical",
  acknowledged: "warning",
  resolved: "success",
};

function relativeTime(iso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const s = Math.round(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function AlertsScreen({
  sb,
  userId,
  onBack: _onBack,
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

  const counts = useMemo(() => {
    const c = { all: alerts.length, active: 0, acknowledged: 0, resolved: 0 };
    for (const a of alerts) c[a.status] += 1;
    return c;
  }, [alerts]);

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

  const FILTERS: Array<{ key: "all" | Status; label: string }> = [
    { key: "active", label: "Active" },
    { key: "acknowledged", label: "Acknowledged" },
    { key: "resolved", label: "Resolved" },
    { key: "all", label: "All" },
  ];

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
              color: connected ? palette.accentDeep : palette.subtle,
              fontWeight: 700,
              padding: "5px 10px",
              borderRadius: radii.pill,
              background: connected ? palette.accentSoft : palette.surfaceAlt,
              border: `1px solid ${connected ? "rgba(15,122,55,0.18)" : palette.hairline}`,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: connected ? palette.accent : palette.subtle,
                boxShadow: connected ? `0 0 0 3px ${palette.accentSoft}` : undefined,
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

      {/* Filter chips — horizontal scroll */}
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 4,
          marginBottom: space.md,
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            active={filter === f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span
              style={{
                marginLeft: 8,
                fontSize: 11,
                opacity: 0.75,
                fontWeight: 700,
              }}
            >
              {counts[f.key]}
            </span>
          </Chip>
        ))}
      </div>

      {composerOpen && (
        <NewAlertComposer
          sb={sb}
          userId={userId}
          onError={setError}
          onDone={() => setComposerOpen(false)}
        />
      )}

      {loading && !refreshing ? (
        <div style={{ display: "grid", gap: 10 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon="◎"
          title={`No ${filter === "all" ? "" : STATUS_LABEL[filter].toLowerCase() + " "}alerts`}
          body="Pull down to refresh, or tap the button to broadcast a new alert."
          action={
            !composerOpen && (
              <button
                type="button"
                className="mobile-tap"
                style={{ ...primaryButton, padding: "0 18px" }}
                onClick={() => setComposerOpen(true)}
              >
                New alert
              </button>
            )
          }
        />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
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

      {!composerOpen && (
        <FAB label="New alert" onClick={() => setComposerOpen(true)} />
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
  const tint = SEVERITY_SOFT[row.severity];
  return (
    <article
      style={{
        background: palette.surface,
        border: `1px solid ${palette.hairline}`,
        borderRadius: radii.xl,
        padding: space.lg,
        boxShadow: shadow.card,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Accent bar */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: tone,
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: space.md,
          marginBottom: space.sm,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            flex: "0 0 auto",
            width: 40,
            height: 40,
            borderRadius: 12,
            background: tint,
            color: tone,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          !
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontFamily: "ui-monospace, Menlo, monospace",
                fontWeight: 700,
                fontSize: type.headline,
                color: palette.ink,
                letterSpacing: -0.2,
              }}
            >
              {row.patient_ref}
            </span>
            <Pill tone={STATUS_TONE[row.status]} dot>
              {STATUS_LABEL[row.status]}
            </Pill>
          </div>
          <div
            style={{
              fontSize: 11,
              color: palette.muted,
              fontWeight: 600,
              letterSpacing: 0.3,
              textTransform: "uppercase",
            }}
          >
            {SEVERITY_LABEL[row.severity]} · {relativeTime(row.created_at)}
          </div>
        </div>
      </div>

      <p
        style={{
          margin: `${space.sm}px 0 ${space.md}px`,
          fontSize: type.body,
          whiteSpace: "pre-wrap",
          lineHeight: 1.4,
          color: palette.ink,
        }}
      >
        {row.summary}
      </p>

      <p
        style={{
          margin: `0 0 ${space.md}px`,
          fontSize: 12,
          color: palette.subtle,
          lineHeight: 1.4,
        }}
      >
        by {authorName}
        {ackName && ` · ack by ${ackName}`}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {row.status === "active" && (
          <button
            type="button"
            className="mobile-tap"
            style={ghostButton}
            onClick={onAcknowledge}
          >
            Acknowledge
          </button>
        )}
        {row.status !== "resolved" && (
          <button
            type="button"
            className="mobile-tap"
            style={accentButton}
            onClick={onResolve}
          >
            Resolve
          </button>
        )}
        {isMine && (
          <button
            type="button"
            className="mobile-tap"
            style={{
              ...ghostButton,
              color: palette.critical,
              borderColor: "rgba(215,38,61,0.25)",
              marginLeft: "auto",
            }}
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
    <Card style={{ marginBottom: space.md }}>
      <h2
        style={{
          margin: `0 0 ${space.md}px`,
          fontSize: type.title3,
          fontWeight: 700,
          letterSpacing: -0.3,
          color: palette.ink,
        }}
      >
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
          margin: `${space.sm}px 0 ${space.md}px`,
        }}
      >
        {(["critical", "warning", "info"] as Severity[]).map((s) => {
          const isActive = severity === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSeverity(s)}
              className="mobile-tap"
              style={{
                ...buttonBase,
                minHeight: 42,
                fontSize: 13,
                background: isActive ? SEVERITY_COLOR[s] : SEVERITY_SOFT[s],
                color: isActive ? "#fff" : SEVERITY_COLOR[s],
                borderColor: isActive ? SEVERITY_COLOR[s] : "transparent",
                fontWeight: 700,
              }}
            >
              {SEVERITY_LABEL[s]}
            </button>
          );
        })}
      </div>

      <textarea
        rows={4}
        placeholder="What's happening, what's needed, time-sensitive details…"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        style={textareaStyle}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: space.sm,
          marginTop: space.sm,
        }}
      >
        <button
          type="button"
          className="mobile-tap"
          style={ghostButton}
          onClick={onDone}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mobile-tap"
          style={{
            ...primaryButton,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {saving && <Spinner size={14} color={palette.surface} />}
          {saving ? "Broadcasting…" : "Broadcast alert"}
        </button>
      </div>
    </Card>
  );
}

// Re-export to satisfy unused-import linters if any
export const __unused = { dangerButton };
