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
  EmptyState,
  LoadingBlock,
  Spinner,
  buttonBase,
  inputStyle,
  labelStyle,
  pageStyle,
  palette,
  primaryButton,
  selectStyle,
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

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: palette.muted,
  normal: palette.ink,
  high: palette.warning,
  urgent: palette.critical,
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "done", "cancelled"];



type TaskInput = {
  title: string;
  description: string;
  patient_ref: string;
  status: TaskStatus;
  priority: TaskPriority;
  owner_id: string;
  due_at: string | null;
};

export function TasksScreen({
  sb,
  userId,
  onBack,
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
  const [filter, setFilter] = useState<"all" | TaskStatus>("todo");
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
          editing.mode === "edit" ? toInput(editing.row, userId) : blankInput(userId)
        }
        editingTitle={editing.mode === "edit" ? editing.row.title : null}
        profiles={profiles}
        currentUserId={userId}
        onCancel={() => {
          console.log("[tasks] cancel tapped");
          setEditing(null);
        }}
        onSave={(input) =>
          handleSave(input, editing.mode === "edit" ? editing.row : null)
        }
      />
    );
  }

  return (
    <main style={pageStyle}>
      {indicator}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: space.md,
        }}
      >
        <button type="button" onClick={onBack} style={buttonBase} className="mobile-tap">
          ← Back
        </button>
        <span
          style={{
            fontSize: 12,
            color: connected ? palette.ok : palette.muted,
            fontWeight: 600,
          }}
        >
          {connected ? "● Live" : "○ Offline"}
        </span>
      </div>

      <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 700 }}>
        Shift Tasks
      </h1>
      <p style={{ margin: `0 0 ${space.lg}px`, fontSize: 13, color: palette.muted }}>
        Assign action items. Updates sync live across the shift.
      </p>

      {error && (
        <div
          style={{
            border: `1px solid ${palette.critical}`,
            background: "#fde8ec",
            color: palette.critical,
            padding: "8px 10px",
            fontSize: 13,
            borderRadius: 10,
            marginBottom: space.md,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 6,
          marginBottom: space.md,
        }}
      >
        {(["todo", "in_progress", "done", "all"] as const).map((f) => (
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
        onClick={() => {
          console.log("[tasks] new tapped");
          setEditing({ mode: "create" });
        }}
        className="mobile-tap"
        style={{ ...primaryButton, width: "100%", marginBottom: space.md }}
      >
        + New task
      </button>

      {loading && !refreshing ? (
        <LoadingBlock label="Loading tasks…" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="✓"
          title={
            filter === "all"
              ? "No tasks yet"
              : `No ${STATUS_LABEL[filter].toLowerCase()} tasks`
          }
          body="Tap + New task to assign action items to your team."
        />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
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
  const tone = PRIORITY_COLOR[row.priority];
  const due = row.due_at ? new Date(row.due_at) : null;
  const overdue = due && row.status !== "done" && due.getTime() < Date.now();

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
          {PRIORITY_LABEL[row.priority]}
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
        {row.patient_ref && (
          <span
            style={{
              fontFamily: "ui-monospace, Menlo, monospace",
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {row.patient_ref}
          </span>
        )}
      </div>

      <h2 style={{ margin: "2px 0 6px", fontSize: 16, fontWeight: 700 }}>
        {row.title}
      </h2>

      {row.description && (
        <p
          style={{
            margin: "0 0 8px",
            fontSize: 14,
            whiteSpace: "pre-wrap",
            lineHeight: 1.35,
            color: palette.ink,
          }}
        >
          {row.description}
        </p>
      )}

      <p style={{ margin: "0 0 4px", fontSize: 12, color: palette.muted }}>
        Owner: {ownerName}
        {isMine && " · you"}
      </p>
      <p style={{ margin: "0 0 4px", fontSize: 11, color: palette.muted }}>
        Created by {creatorName} · {new Date(row.created_at).toLocaleString()}
      </p>
      {due && (
        <p
          style={{
            margin: "0 0 10px",
            fontSize: 12,
            fontWeight: overdue ? 700 : 500,
            color: overdue ? palette.critical : palette.muted,
          }}
        >
          Due {due.toLocaleString()}
          {overdue && " · overdue"}
        </p>
      )}

      <label style={{ ...labelStyle, marginTop: 6 }}>Status</label>
      <select
        value={row.status}
        onChange={(e) => onChangeStatus(e.target.value as TaskStatus)}
        style={{ ...selectStyle, marginBottom: 10 }}
      >
        {STATUS_ORDER.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" style={{ ...buttonBase, flex: 1 }} onClick={onEdit}>
          Edit
        </button>
        {canDelete && (
          <button
            type="button"
            style={{ ...buttonBase, color: palette.critical }}
            onClick={onDelete}
          >
            Delete
          </button>
        )}
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

// Convert ISO string to value for <input type="datetime-local">.
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

  // Ensure currentUser appears in the owner list even if profiles aren't loaded yet.
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
          marginBottom: 12,
        }}
      >
        <button type="button" onClick={onCancel} style={buttonBase} className="mobile-tap">
          ← Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            console.log("[tasks] save tapped", { canSave, saving });
            handleSubmit();
          }}
          className="mobile-tap"
          style={{
            ...primaryButton,
            opacity: saving ? 0.7 : 1,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {saving && <Spinner size={14} color={palette.surface} />}
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <h1 style={{ margin: "0 0 14px", fontSize: 22, fontWeight: 700 }}>
        {editingTitle ? `Edit "${editingTitle}"` : "New task"}
      </h1>

      {err && (
        <div
          style={{
            border: `1px solid ${palette.critical}`,
            background: "#fde8ec",
            color: palette.critical,
            padding: "8px 10px",
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {err}
        </div>
      )}

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

      <label style={labelStyle}>Priority</label>
      <select
        style={selectStyle}
        value={priority}
        onChange={(e) => setPriority(e.target.value as TaskPriority)}
      >
        {(["low", "normal", "high", "urgent"] as const).map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABEL[p]}
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
    </main>
  );
}
