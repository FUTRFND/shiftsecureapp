// Native Templates screen — local state, plain HTML, no router/UI libs.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PRESETS,
  newSectionId,
  type Section,
  type TemplateInput,
  type TemplateRow,
} from "../lib/templates";
import {
  Banner,
  EmptyState,
  ScreenHeader,
  LoadingBlock,
  Spinner,
  buttonBase,
  inputStyle,
  labelStyle,
  pageStyle,
  palette,
  primaryButton,
  space,
  textareaStyle,
  useConfirm,
  useKeyboardScrollIntoView,
  usePullToRefresh,
} from "./ui";


export function TemplatesScreen({
  sb,
  userId,
  onBack,
}: {
  sb: SupabaseClient;
  userId: string;
  onBack: () => void;
}) {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<
    | { mode: "create"; initial: TemplateInput | null }
    | { mode: "edit"; row: TemplateRow }
    | null
  >(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error: e } = await sb
      .from("handoff_templates")
      .select("*")
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false });
    if (e) setError(e.message);
    setTemplates((data ?? []) as TemplateRow[]);
    setLoading(false);
  }, [sb]);

  useKeyboardScrollIntoView();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { refreshing, indicator } = usePullToRefresh(load, {
    enabled: !editing,
  });

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(input: TemplateInput, editingRow: TemplateRow | null) {
    if (input.is_default) {
      const { error: clearErr } = await sb
        .from("handoff_templates")
        .update({ is_default: false })
        .eq("user_id", userId);
      if (clearErr) {
        console.error("[templates] clear default failed", clearErr);
        throw new Error(clearErr.message);
      }
    }
    if (editingRow) {
      const { error: e } = await sb
        .from("handoff_templates")
        .update({ ...input })
        .eq("id", editingRow.id);
      if (e) {
        console.error("[templates] update failed", e);
        throw new Error(e.message);
      }
    } else {
      const { error: e } = await sb
        .from("handoff_templates")
        .insert({ ...input, user_id: userId });
      if (e) {
        console.error("[templates] insert failed", e);
        throw new Error(e.message);
      }
    }
    setEditing(null);
    await load();
  }

  async function handleDelete(row: TemplateRow) {
    const ok = await confirm({
      title: `Delete "${row.name}"?`,
      body: "This template will be removed from your library.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const { error: e } = await sb
      .from("handoff_templates")
      .delete()
      .eq("id", row.id);
    if (e) {
      setError(e.message);
      return;
    }
    await load();
  }

  if (editing) {
    return (
      <TemplateEditor
        initial={
          editing.mode === "edit"
            ? toInput(editing.row)
            : (editing.initial ?? blankInput())
        }
        editingName={editing.mode === "edit" ? editing.row.name : null}
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
      </div>

      <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 700 }}>
        Handoff Templates
      </h1>
      <p style={{ margin: `0 0 ${space.lg}px`, fontSize: 13, color: palette.muted }}>
        Structured templates ensure nothing critical is missed.
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

      <button
        type="button"
        onClick={() => setEditing({ mode: "create", initial: null })}
        className="mobile-tap"
        style={{ ...primaryButton, width: "100%", marginBottom: space.md }}
      >
        + New template
      </button>

      {loading && !refreshing ? (
        <LoadingBlock label="Loading templates…" />
      ) : templates.length === 0 ? (
        <EmptyState
          icon="▤"
          title="No templates yet"
          body="Start from a preset to build your first handoff template."
          action={
            <div style={{ display: "grid", gap: 8, minWidth: 240 }}>
              {PRESETS.filter((p) => p.label !== "Blank").map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="mobile-tap"
                  style={buttonBase}
                  onClick={() =>
                    setEditing({ mode: "create", initial: p.template })
                  }
                >
                  Start from {p.label}
                </button>
              ))}
            </div>
          }
        />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              row={t}
              onEdit={() => setEditing({ mode: "edit", row: t })}
              onDelete={() => handleDelete(t)}
            />
          ))}
        </div>
      )}
      {confirmDialog}
    </main>
  );
}


function TemplateCard({
  row,
  onEdit,
  onDelete,
}: {
  row: TemplateRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article
      style={{
        background: palette.surface,
        border: `1px solid ${palette.hairline}`,
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{row.name}</h2>
        {row.is_default && (
          <span
            style={{
              background: palette.ink,
              color: palette.surface,
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            Default
          </span>
        )}
      </div>
      {row.description && (
        <p style={{ margin: "0 0 8px", fontSize: 14, color: palette.muted }}>
          {row.description}
        </p>
      )}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 10,
          fontSize: 11,
          color: palette.muted,
        }}
      >
        {row.specialty && (
          <span style={{ border: `1px solid ${palette.border}`, padding: "2px 6px" }}>
            {row.specialty}
          </span>
        )}
        <span style={{ border: `1px solid ${palette.border}`, padding: "2px 6px" }}>
          {row.sections?.length ?? 0} sections
        </span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="mobile-tap"
          style={{ ...buttonBase, flex: 1 }}
          onClick={onEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="mobile-tap"
          style={{ ...buttonBase, color: palette.critical }}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function blankInput(): TemplateInput {
  return {
    name: "",
    description: "",
    specialty: "",
    is_default: false,
    sections: [
      { id: newSectionId(), title: "Section 1", placeholder: "", required: false },
    ],
  };
}

function toInput(row: TemplateRow): TemplateInput {
  return {
    name: row.name,
    description: row.description ?? "",
    specialty: row.specialty ?? "",
    is_default: row.is_default ?? false,
    sections: row.sections?.length
      ? row.sections
      : [{ id: newSectionId(), title: "Section 1", placeholder: "", required: false }],
  };
}

function TemplateEditor({
  initial,
  editingName,
  onCancel,
  onSave,
}: {
  initial: TemplateInput;
  editingName: string | null;
  onCancel: () => void;
  onSave: (input: TemplateInput) => void | Promise<void>;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [specialty, setSpecialty] = useState(initial.specialty);
  const [isDefault, setIsDefault] = useState(initial.is_default);
  const [sections, setSections] = useState<Section[]>(initial.sections);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useKeyboardScrollIntoView();


  const canSave = useMemo(
    () =>
      name.trim().length >= 2 &&
      sections.length > 0 &&
      sections.every((s) => s.title.trim().length > 0),
    [name, sections],
  );

  function updateSection(id: string, patch: Partial<Section>) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }
  function addSection() {
    setSections((prev) => [
      ...prev,
      {
        id: newSectionId(),
        title: `Section ${prev.length + 1}`,
        placeholder: "",
        required: false,
      },
    ]);
  }
  function moveSection(id: string, dir: -1 | 1) {
    setSections((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function handleSubmit() {
    if (saving) return;
    if (!canSave) {
      setErr("Name (min 2 chars) and every section title are required.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        specialty: specialty.trim(),
        is_default: isDefault,
        sections: sections.map((s) => ({
          id: s.id,
          title: s.title.trim(),
          placeholder: (s.placeholder ?? "").trim(),
          required: !!s.required,
        })),
      });
    } catch (e) {
      console.error("[templates] save failed", e);
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  // iOS WebView: ensure taps register reliably on these top-bar buttons.
  const tapFix: React.CSSProperties = {
    cursor: "pointer",
    touchAction: "manipulation",
    WebkitAppearance: "none",
    WebkitTapHighlightColor: "rgba(0,0,0,0.1)",
  };

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
        <button
          type="button"
          onClick={() => {
            console.log("[templates] cancel tapped");
            onCancel();
          }}
          style={{ ...buttonBase, ...tapFix }}
        >
          ← Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            console.log("[templates] save tapped", { canSave, saving });
            handleSubmit();
          }}
          aria-disabled={saving}
          className="mobile-tap"
          style={{
            ...primaryButton,
            ...tapFix,
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
        {editingName ? `Edit "${editingName}"` : "New template"}
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

      <label style={labelStyle}>Name</label>
      <input
        style={inputStyle}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="SBAR Handoff"
      />

      <label style={labelStyle}>Description</label>
      <textarea
        style={textareaStyle}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Short summary"
      />

      <label style={labelStyle}>Specialty</label>
      <input
        style={inputStyle}
        value={specialty}
        onChange={(e) => setSpecialty(e.target.value)}
        placeholder="Emergency Medicine"
      />

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          margin: "4px 0 18px",
          fontSize: 14,
        }}
      >
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
          style={{ width: 18, height: 18 }}
        />
        Use as my default template
      </label>

      <h2 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>Sections</h2>

      <div style={{ display: "grid", gap: 10 }}>
        {sections.map((s, idx) => (
          <div
            key={s.id}
            style={{
              border: `1px solid ${palette.border}`,
              background: palette.surface,
              padding: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: palette.muted }}>
                #{idx + 1}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  style={{ ...buttonBase, minHeight: 32, padding: "0 8px", fontSize: 13 }}
                  onClick={() => moveSection(s.id, -1)}
                  disabled={idx === 0}
                >
                  ↑
                </button>
                <button
                  type="button"
                  style={{ ...buttonBase, minHeight: 32, padding: "0 8px", fontSize: 13 }}
                  onClick={() => moveSection(s.id, 1)}
                  disabled={idx === sections.length - 1}
                >
                  ↓
                </button>
                <button
                  type="button"
                  style={{
                    ...buttonBase,
                    minHeight: 32,
                    padding: "0 8px",
                    fontSize: 13,
                    color: palette.critical,
                  }}
                  onClick={() => removeSection(s.id)}
                  disabled={sections.length <= 1}
                >
                  Remove
                </button>
              </div>
            </div>

            <label style={labelStyle}>Title</label>
            <input
              style={inputStyle}
              value={s.title}
              onChange={(e) => updateSection(s.id, { title: e.target.value })}
            />
            <label style={labelStyle}>Placeholder</label>
            <textarea
              style={textareaStyle}
              value={s.placeholder ?? ""}
              onChange={(e) => updateSection(s.id, { placeholder: e.target.value })}
            />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={!!s.required}
                onChange={(e) => updateSection(s.id, { required: e.target.checked })}
                style={{ width: 18, height: 18 }}
              />
              Required
            </label>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addSection}
        style={{ ...buttonBase, width: "100%", marginTop: 12 }}
      >
        + Add section
      </button>
    </main>
  );
}
