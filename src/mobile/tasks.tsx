// Native Tasks screen — local state, plain HTML, no router/UI libs.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type ProfileLite,
  type TaskPriority,
  type TaskRow,
  type TaskStatus,
} from "../lib/tasks";
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
  buttonBase,
  cardStyle,
  ghostButton,
  inputStyle,
  labelStyle,
  pageStyle,
  palette,
  primaryButton,
  radii,
  selectStyle,
  shadow,
  space,
  textareaStyle,
  useConfirm,
  useKeyboardScrollIntoView,
  usePullToRefresh,
} from "./ui";

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const PRIORITY_TONE: Record<
  TaskPriority,
  "neutral" | "info" | "warning" | "critical"
> = {
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "critical",
};

const PRIORITY_ACCENT: Record<TaskPriority, string> = {
  low: palette.subtle,
  normal: palette.info,
  high: palette.warning,
  urgent: palette.critical,
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<
  TaskStatus,
  "neutral" | "info" | "success" | "warning"
> = {
  todo: "neutral",
  in_progress: "info",
  done: "success",
  cancelled: "warning",
};

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "done", "cancelled"];

type FilterKey = "todo" | "in_progress" | "done" | "all";
const FILTER_ORDER: FilterKey[] = ["todo", "in_progress", "done", "all"];
const FILTER_LABEL: Record<FilterKey, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  all: "All",
};

type TaskInput = {
  title: string;
  description: string;
  patient_ref: string;
  status: TaskStatus;
  priority: TaskPriority;
  owner_id: string;
  due_at: string | null;
};

function formatRelative(iso: string): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const diff = Date.now() - d;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatDue(iso: string): { label: string; overdueText: string | null } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { label: "", overdueText: null };
  const diff = d.getTime() - Date.now();
  const abs = Math.abs(diff);
  const m = Math.round(abs / 60000);
  const h = Math.round(m / 60);
  const days = Math.round(h / 24);
  let rel = "";
  if (m < 60) rel = `${m}m`;
  else if (h < 24) rel = `${h}h`;
  else rel = `${days}d`;
  return {
    label: d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    overdueText: diff < 0 ? `Overdue by ${rel}` : `Due in ${rel}`,
  };
}

export function TasksScreen({
  sb,
  userId,
  onBack: _onBack,
}: {
  sb: SupabaseClient;
  userId: string;
  onBack: () => void;
}) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("todo");
  const [editing, setEditing] = useState<
    { mode: "create" } | { mode: "edit"; row: TaskRow } | null
  >(null);
  useKeyboardScrollIntoView();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const profilesById = useMemo(() => {
    const m = new Map<string, ProfileLite>();
    for (const p of profiles) m.set(p.id, p);
    return m;
  }, [profiles]);

  const load = useCallback(async () => {
    setError(null);
    const [t, p] = await Promise.all([
      sb.from("tasks").select("*").order("created_at", { ascending: false }),
      sb
        .from("profiles")
        .select("id, full_name, department")
        .order("full_name"),
    ]);
    if (t.error) {
      console.error("[tasks] load tasks failed", t.error);
      setError(t.error.message);
    }
    if (p.error) {
      console.error("[tasks] load profiles failed", p.error);
    }
    setTasks((t.data ?? []) as TaskRow[]);
    setProfiles((p.data ?? []) as ProfileLite[]);
    setLoading(false);
  }, [sb]);

  const { refreshing, indicator } = usePullToRefresh(load, {
    enabled: !editing,
  });

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = sb
      .channel("tasks-mobile")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          setTasks((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as TaskRow;
              if (prev.some((t) => t.id === row.id)) return prev;
              return [row, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as TaskRow;
              return prev.map((t) => (t.id === row.id ? row : t));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as TaskRow;
              return prev.filter((t) => t.id !== row.id);
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

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      todo: 0,
      in_progress: 0,
      done: 0,
      all: tasks.length,
    };
    for (const t of tasks) {
      if (t.status === "todo") c.todo++;
      else if (t.status === "in_progress") c.in_progress++;
      else if (t.status === "done") c.done++;
    }
    return c;
  }, [tasks]);

  const visible = useMemo(
    () => (filter === "all" ? tasks : tasks.filter((t) => t.status === filter)),
    [tasks, filter],
  );

  async function changeStatus(row: TaskRow, status: TaskStatus) {
    const prev = row.status;
    setTasks((ts) => ts.map((t) => (t.id === row.id ? { ...t, status } : t)));
    const { error: e } = await sb
      .from("tasks")
      .update({ status })
      .eq("id", row.id);
    if (e) {
      console.error("[tasks] status update failed", e);
      setError(e.message);
      setTasks((ts) =>
        ts.map((t) => (t.id === row.id ? { ...t, status: prev } : t)),
      );
    }
  }

  async function remove(row: TaskRow) {
    const ok = await confirm({
      title: `Delete "${row.title}"?`,
      body: "This task will be removed for everyone on the shift.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const { error: e } = await sb.from("tasks").delete().eq("id", row.id);
    if (e) {
      console.error("[tasks] delete failed", e);
      setError(e.message);
    }
  }

  async function handleSave(input: TaskInput, editingRow: TaskRow | null) {
    if (editingRow) {
      const { error: e } = await sb
        .from("tasks")
        .update({ ...input })
        .eq("id", editingRow.id);
      if (e) {
        console.error("[tasks] update failed", e);
        throw new Error(e.message);
      }
    } else {
      const { error: e } = await sb
        .from("tasks")
        .insert({ ...input, creator_id: userId });
      if (e) {
        console.error("[tasks] insert failed", e);
        throw new Error(e.message);
      }
    }
    setEditing(null);
    await load();
  }

  if (editing) {
    return (
      <TaskEditor
        initial={
          editing.mode === "edit"
            ? toInput(editing.row, userId)
            : blankInput(userId)
        }
        editingTitle={editing.mode === "edit" ? editing.row.title : null}
        profiles={profiles}
        currentUserId={userId}
        onCancel={() => setEditing(null)}
        onSave={(input) =>
          handleSave(input, editing.mode === "edit" ? editing.row : null)
        }
      />
    );
  }

  return (
    <main style={pageStyle}>
      {indicator}
      <ScreenHeader
        title="Tasks"
        subtitle="Assign action items. Updates sync live across the shift."
        right={
          <Pill tone={connected ? "success" : "neutral"} dot>
            {connected ? "Live" : "Offline"}
          </Pill>
        }
      />

      {error && (
        <Banner tone="error" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}

      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 4,
          marginBottom: space.md,
          scrollbarWidth: "none",
        }}
      >
        {FILTER_ORDER.map((f) => (
          <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
            {FILTER_LABEL[f]}
            <span
              style={{
                marginLeft: 6,
                opacity: 0.7,
                fontWeight: 600,
              }}
            >
              {counts[f]}
            </span>
          </Chip>
        ))}
      </div>

      {loading && !refreshing ? (
        <div style={{ display: "grid", gap: 0 }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon="✓"
          title={
            filter === "all"
              ? "No tasks yet"
              : `No ${FILTER_LABEL[filter].toLowerCase()} tasks`
          }
          body="Tap the + button to assign action items to your team."
        />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {visible.map((t) => (
            <TaskCard
              key={t.id}
              row={t}
              ownerName={profilesById.get(t.owner_id)?.full_name ?? "Unassigned"}
              creatorName={profilesById.get(t.creator_id)?.full_name ?? "—"}
              isMine={t.owner_id === userId}
              canDelete={t.creator_id === userId}
              onChangeStatus={(s) => changeStatus(t, s)}
              onEdit={() => setEditing({ mode: "edit", row: t })}
              onDelete={() => remove(t)}
            />
          ))}
        </div>
      )}

      <FAB label="New task" onClick={() => setEditing({ mode: "create" })} />
      {confirmDialog}
    </main>
  );
}

function TaskCard({
  row,
  ownerName,
  creatorName,
  isMine,
  canDelete,
  onChangeStatus,
  onEdit,
  onDelete,
}: {
  row: TaskRow;
  ownerName: string;
  creatorName: string;
  isMine: boolean;
  canDelete: boolean;
  onChangeStatus: (s: TaskStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const accent = PRIORITY_ACCENT[row.priority];
  const due = row.due_at ? formatDue(row.due_at) : null;
  const overdue =
    row.due_at &&
    row.status !== "done" &&
    new Date(row.due_at).getTime() < Date.now();
  const done = row.status === "done";

  return (
    <article
      style={{
        ...cardStyle,
        padding: 0,
        overflow: "hidden",
        opacity: done ? 0.7 : 1,
      }}
    >
      <div style={{ display: "flex" }}>
        <div
          aria-hidden="true"
          style={{
            width: 4,
            background: accent,
            flex: "0 0 auto",
          }}
        />
        <div style={{ flex: 1, padding: space.lg }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Pill tone={PRIORITY_TONE[row.priority]} dot>
              {PRIORITY_LABEL[row.priority]}
            </Pill>
            <Pill tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Pill>
            {row.patient_ref && (
              <span
                style={{
                  fontFamily: "ui-monospace, Menlo, monospace",
                  fontWeight: 700,
                  fontSize: 12,
                  color: palette.muted,
                  marginLeft: 2,
                }}
              >
                {row.patient_ref}
              </span>
            )}
          </div>

          <h2
            style={{
              margin: "2px 0 6px",
              fontSize: 17,
              fontWeight: 700,
              lineHeight: 1.25,
              textDecoration: done ? "line-through" : undefined,
              color: palette.ink,
            }}
          >
            {row.title}
          </h2>

          {row.description && (
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 14,
                whiteSpace: "pre-wrap",
                lineHeight: 1.4,
                color: palette.muted,
              }}
            >
              {row.description}
            </p>
          )}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              alignItems: "center",
              fontSize: 12,
              color: palette.muted,
              marginBottom: 10,
            }}
          >
            <span style={{ fontWeight: 600, color: palette.ink }}>
              {ownerName}
              {isMine && " · you"}
            </span>
            <span aria-hidden="true">·</span>
            <span>by {creatorName}</span>
            <span aria-hidden="true">·</span>
            <span>{formatRelative(row.created_at)}</span>
          </div>

          {due && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: radii.pill,
                background: overdue ? palette.criticalSoft : palette.surfaceAlt,
                color: overdue ? palette.critical : palette.muted,
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              <span aria-hidden="true">◴</span>
              {due.overdueText} · {due.label}
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Update status</label>
            <select
              value={row.status}
              onChange={(e) => onChangeStatus(e.target.value as TaskStatus)}
              style={selectStyle}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              style={{ ...ghostButton, flex: 1 }}
              className="mobile-tap"
              onClick={onEdit}
            >
              Edit
            </button>
            {canDelete && (
              <button
                type="button"
                style={{
                  ...ghostButton,
                  color: palette.critical,
                  borderColor: palette.criticalSoft,
                }}
                className="mobile-tap"
                onClick={onDelete}
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function blankInput(userId: string): TaskInput {
  return {
    title: "",
    description: "",
    patient_ref: "",
    status: "todo",
    priority: "normal",
    owner_id: userId,
    due_at: null,
  };
}

function toInput(row: TaskRow, _userId: string): TaskInput {
  return {
    title: row.title,
    description: row.description ?? "",
    patient_ref: row.patient_ref ?? "",
    status: row.status,
    priority: row.priority,
    owner_id: row.owner_id,
    due_at: row.due_at,
  };
}

function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function TaskEditor({
  initial,
  editingTitle,
  profiles,
  currentUserId,
  onCancel,
  onSave,
}: {
  initial: TaskInput;
  editingTitle: string | null;
  profiles: ProfileLite[];
  currentUserId: string;
  onCancel: () => void;
  onSave: (input: TaskInput) => void | Promise<void>;
}) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [patientRef, setPatientRef] = useState(initial.patient_ref);
  const [status, setStatus] = useState<TaskStatus>(initial.status);
  const [priority, setPriority] = useState<TaskPriority>(initial.priority);
  const [ownerId, setOwnerId] = useState(initial.owner_id || currentUserId);
  const [dueLocal, setDueLocal] = useState(isoToLocalInput(initial.due_at));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useKeyboardScrollIntoView();

  const canSave = title.trim().length > 0 && ownerId.length > 0;

  const ownerOptions = useMemo(() => {
    const list = profiles.slice();
    if (!list.some((p) => p.id === currentUserId)) {
      list.unshift({ id: currentUserId, full_name: "Me", department: "" });
    }
    return list;
  }, [profiles, currentUserId]);

  async function handleSubmit() {
    if (saving) return;
    if (!canSave) {
      setErr("Title and owner are required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        patient_ref: patientRef.trim(),
        status,
        priority,
        owner_id: ownerId,
        due_at: localInputToIso(dueLocal),
      });
    } catch (e) {
      console.error("[tasks] save failed", e);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={pageStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: space.lg,
          position: "sticky",
          top: 0,
          background: palette.bg,
          paddingBottom: space.sm,
          zIndex: 5,
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          style={ghostButton}
          className="mobile-tap"
        >
          ← Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSave || saving}
          className="mobile-tap"
          style={{
            ...primaryButton,
            opacity: !canSave || saving ? 0.6 : 1,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {saving && <Spinner size={14} color="#fff" />}
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <h1
        style={{
          margin: "0 0 14px",
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: -0.4,
        }}
      >
        {editingTitle ? `Edit "${editingTitle}"` : "New task"}
      </h1>

      {err && <Banner tone="error" onDismiss={() => setErr(null)}>{err}</Banner>}

      <Card>
        <label style={labelStyle}>Title</label>
        <input
          style={inputStyle}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Recheck vitals at bedside 4"
        />

        <label style={labelStyle}>Description</label>
        <textarea
          style={textareaStyle}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional context"
        />

        <label style={labelStyle}>Patient reference</label>
        <input
          style={inputStyle}
          value={patientRef}
          onChange={(e) => setPatientRef(e.target.value)}
          placeholder="e.g. Bed 4 / MRN-1234"
        />
      </Card>

      <div style={{ height: space.md }} />

      <Card>
        <label style={labelStyle}>Priority</label>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 6,
            marginBottom: space.md,
          }}
        >
          {(["low", "normal", "high", "urgent"] as const).map((p) => {
            const active = priority === p;
            const accent = PRIORITY_ACCENT[p];
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className="mobile-tap"
                style={{
                  ...buttonBase,
                  minHeight: 40,
                  padding: "0 6px",
                  fontSize: 12,
                  fontWeight: 700,
                  background: active ? accent : palette.surface,
                  borderColor: active ? accent : palette.hairline,
                  color: active ? "#fff" : palette.ink,
                  boxShadow: active ? shadow.card : undefined,
                }}
              >
                {PRIORITY_LABEL[p]}
              </button>
            );
          })}
        </div>

        <label style={labelStyle}>Owner</label>
        <select
          style={selectStyle}
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
        >
          {ownerOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name || "Unnamed"}
              {p.id === currentUserId ? " (me)" : ""}
            </option>
          ))}
        </select>

        <label style={labelStyle}>Status</label>
        <select
          style={selectStyle}
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus)}
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>

        <label style={labelStyle}>Due (optional)</label>
        <input
          type="datetime-local"
          style={inputStyle}
          value={dueLocal}
          onChange={(e) => setDueLocal(e.target.value)}
        />
      </Card>
    </main>
  );
}
