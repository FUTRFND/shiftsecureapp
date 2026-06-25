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
  Card,
  EmptyState,
  FAB,
  Pill,
  ScreenHeader,
  SectionHeader,
  SkeletonCard,
  Spinner,
  buttonBase,
  ghostButton,
  inputStyle,
  labelStyle,
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


export function TemplatesScreen({
  sb,
  userId,
  onBack: _onBack,
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
  const [presetSheet, setPresetSheet] = useState(false);

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

  const presets = PRESETS.filter((p) => p.label !== "Blank");

  return (
    <main style={pageStyle}>
      {indicator}
      <ScreenHeader
        title="Templates"
        subtitle="Structured templates ensure nothing critical is missed."
      />

      {error && (
        <Banner tone="error" onDismiss={() => setError(null)}>
          {error}
        </Banner>
      )}

      {/* Preset quick-start row */}
      {!loading && templates.length > 0 && (
        <>
          <SectionHeader title="Start from a preset" />
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
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                className="mobile-tap"
                onClick={() => setEditing({ mode: "create", initial: p.template })}
                style={{
                  flex: "0 0 auto",
                  padding: "10px 14px",
                  borderRadius: radii.pill,
                  border: `1px solid ${palette.hairline}`,
                  background: palette.surface,
                  color: palette.ink,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  WebkitAppearance: "none",
                  touchAction: "manipulation",
                  boxShadow: shadow.card,
                }}
              >
                + {p.label}
              </button>
            ))}
          </div>
          <SectionHeader title="Your templates" />
        </>
      )}

      {loading && !refreshing ? (
        <div style={{ display: "grid", gap: 10 }}>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon="▤"
          title="No templates yet"
          body="Start from a preset to build your first handoff template."
          action={
            <div style={{ display: "grid", gap: 8, minWidth: 240 }}>
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="mobile-tap"
                  style={{ ...primaryButton }}
                  onClick={() =>
                    setEditing({ mode: "create", initial: p.template })
                  }
                >
                  Start from {p.label}
                </button>
              ))}
              <button
                type="button"
                className="mobile-tap"
                style={ghostButton}
                onClick={() => setEditing({ mode: "create", initial: null })}
              >
                Start blank
              </button>
            </div>
          }
        />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
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

      <FAB label="New" onClick={() => setPresetSheet(true)} />

      {presetSheet && (
        <PresetSheet
          presets={presets}
          onPick={(initial) => {
            setPresetSheet(false);
            setEditing({ mode: "create", initial });
          }}
          onBlank={() => {
            setPresetSheet(false);
            setEditing({ mode: "create", initial: null });
          }}
          onClose={() => setPresetSheet(false)}
        />
      )}

      {confirmDialog}
    </main>
  );
}

function PresetSheet({
  presets,
  onPick,
  onBlank,
  onClose,
}: {
  presets: typeof PRESETS;
  onPick: (initial: TemplateInput) => void;
  onBlank: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: palette.overlay,
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: space.md,
        paddingBottom: `calc(${space.md}px + env(safe-area-inset-bottom, 0px))`,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: palette.surface,
          borderRadius: radii.xxl,
          padding: space.lg,
          boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
          animation: "mobile-fade-in 200ms ease-out both",
        }}
      >
        <h2
          style={{
            margin: `0 0 4px`,
            fontSize: type.title3,
            fontWeight: 700,
            letterSpacing: -0.3,
          }}
        >
          New template
        </h2>
        <p
          style={{
            margin: `0 0 ${space.md}px`,
            fontSize: 13,
            color: palette.muted,
          }}
        >
          Pick a starting point.
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              className="mobile-tap"
              onClick={() => onPick(p.template)}
              style={{
                ...buttonBase,
                justifyContent: "flex-start",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                minHeight: 56,
                background: palette.surfaceAlt,
                borderColor: "transparent",
                textAlign: "left",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: palette.accentSoft,
                  color: palette.accentDeep,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 16,
                }}
              >
                {p.label.charAt(0)}
              </span>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontWeight: 700, color: palette.ink }}>
                  {p.label}
                </span>
                <span style={{ fontSize: 12, color: palette.muted }}>
                  {p.template.sections.length} sections
                </span>
              </div>
            </button>
          ))}
          <button
            type="button"
            className="mobile-tap"
            style={ghostButton}
            onClick={onBlank}
          >
            Start blank
          </button>
          <button
            type="button"
            className="mobile-tap"
            style={{ ...ghostButton, marginTop: 4 }}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
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
  const sectionCount = row.sections?.length ?? 0;
  return (
    <Card>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: space.md,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            flex: "0 0 auto",
            width: 44,
            height: 44,
            borderRadius: 12,
            background: palette.accentSoft,
            color: palette.accentDeep,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 800,
          }}
        >
          {row.name?.charAt(0)?.toUpperCase() || "T"}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: type.headline,
                fontWeight: 700,
                letterSpacing: -0.2,
                color: palette.ink,
              }}
            >
              {row.name}
            </h2>
            {row.is_default && <Pill tone="accent">Default</Pill>}
          </div>
          {row.description && (
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 13,
                color: palette.muted,
                lineHeight: 1.4,
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
              marginTop: 8,
            }}
          >
            {row.specialty && <Pill tone="info">{row.specialty}</Pill>}
            <Pill tone="neutral">
              {sectionCount} {sectionCount === 1 ? "section" : "sections"}
            </Pill>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: space.md,
        }}
      >
        <button
          type="button"
          className="mobile-tap"
          style={{ ...primaryButton, flex: 1 }}
          onClick={onEdit}
        >
          Edit
        </button>
        <button
          type="button"
          className="mobile-tap"
          aria-label={`Delete ${row.name}`}
          style={{
            ...ghostButton,
            color: palette.critical,
            borderColor: "rgba(215,38,61,0.25)",
            paddingLeft: 14,
            paddingRight: 14,
          }}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </Card>
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

function ToggleRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 14px",
        background: palette.surface,
        border: `1px solid ${palette.hairline}`,
        borderRadius: radii.md,
        cursor: "pointer",
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: palette.ink }}>
          {label}
        </span>
        {hint && (
          <span style={{ fontSize: 12, color: palette.muted, marginTop: 2 }}>
            {hint}
          </span>
        )}
      </span>
      <span
        role="switch"
        aria-checked={checked}
        style={{
          position: "relative",
          width: 50,
          height: 30,
          borderRadius: 999,
          background: checked ? palette.accent : palette.surfaceAlt,
          border: `1px solid ${checked ? palette.accent : palette.hairline}`,
          transition: "background 160ms ease, border-color 160ms ease",
          flex: "0 0 auto",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 22 : 2,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 2px 4px rgba(0,0,0,0.18)",
            transition: "left 160ms ease",
          }}
        />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          position: "absolute",
          opacity: 0,
          pointerEvents: "none",
          width: 0,
          height: 0,
        }}
      />
    </label>
  );
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
      {/* Sticky-feeling top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: space.md,
        }}
      >
        <button
          type="button"
          onClick={() => {
            console.log("[templates] cancel tapped");
            onCancel();
          }}
          className="mobile-tap"
          style={{ ...ghostButton, ...tapFix }}
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
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {saving && <Spinner size={14} color={palette.surface} />}
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      <h1
        style={{
          margin: `0 0 ${space.lg}px`,
          fontSize: type.title1,
          fontWeight: 700,
          letterSpacing: -0.6,
          color: palette.ink,
        }}
      >
        {editingName ? `Edit "${editingName}"` : "New template"}
      </h1>

      {err && (
        <Banner tone="error" onDismiss={() => setErr(null)}>
          {err}
        </Banner>
      )}

      <Card style={{ marginBottom: space.md }}>
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
          style={{ ...inputStyle, marginBottom: space.md }}
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          placeholder="Emergency Medicine"
        />

        <ToggleRow
          checked={isDefault}
          onChange={setIsDefault}
          label="Default template"
          hint="Pre-selected when starting a new handoff."
        />
      </Card>

      <SectionHeader
        title="Sections"
        action={
          <span style={{ fontSize: 12, color: palette.subtle, fontWeight: 600 }}>
            {sections.length}
          </span>
        }
      />

      <div style={{ display: "grid", gap: 12 }}>
        {sections.map((s, idx) => (
          <Card key={s.id} padded={false} style={{ padding: space.md }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: space.sm,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 26,
                  height: 26,
                  padding: "0 8px",
                  borderRadius: radii.pill,
                  background: palette.surfaceAlt,
                  fontSize: 12,
                  fontWeight: 800,
                  color: palette.muted,
                }}
              >
                #{idx + 1}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="mobile-tap"
                  style={{
                    ...ghostButton,
                    minHeight: 34,
                    padding: "0 10px",
                    fontSize: 14,
                  }}
                  onClick={() => moveSection(s.id, -1)}
                  disabled={idx === 0}
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="mobile-tap"
                  style={{
                    ...ghostButton,
                    minHeight: 34,
                    padding: "0 10px",
                    fontSize: 14,
                  }}
                  onClick={() => moveSection(s.id, 1)}
                  disabled={idx === sections.length - 1}
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="mobile-tap"
                  style={{
                    ...ghostButton,
                    minHeight: 34,
                    padding: "0 10px",
                    fontSize: 13,
                    color: palette.critical,
                    borderColor: "rgba(215,38,61,0.25)",
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
              style={{ ...textareaStyle, marginBottom: space.sm }}
              value={s.placeholder ?? ""}
              onChange={(e) => updateSection(s.id, { placeholder: e.target.value })}
            />
            <ToggleRow
              checked={!!s.required}
              onChange={(v) => updateSection(s.id, { required: v })}
              label="Required"
              hint="Cannot be skipped when filling in a handoff."
            />
          </Card>
        ))}
      </div>

      <button
        type="button"
        onClick={addSection}
        className="mobile-tap"
        style={{
          ...ghostButton,
          width: "100%",
          marginTop: space.md,
          marginBottom: space.xl,
          borderStyle: "dashed",
        }}
      >
        + Add section
      </button>
    </main>
  );
}
