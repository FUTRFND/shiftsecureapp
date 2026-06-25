// Native Voice screen — local state, plain HTML, no router/UI libs.
// Uses Web Speech API when available (iOS WKWebView lacks it — falls back
// to manual transcript entry). Calls the ai-handoff edge function directly.
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

const palette = {
  bg: "#f7f7f2",
  ink: "#121212",
  muted: "#454545",
  border: "#121212",
  surface: "#ffffff",
  critical: "#b00020",
  accent: "#1b4d8f",
  ok: "#0a7a3b",
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  boxSizing: "border-box",
  padding: "20px 16px 80px",
  background: palette.bg,
  color: palette.ink,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const buttonBase: React.CSSProperties = {
  minHeight: 44,
  border: `1px solid ${palette.border}`,
  background: palette.surface,
  color: palette.ink,
  fontSize: 15,
  fontWeight: 600,
  padding: "0 14px",
  cursor: "pointer",
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  minHeight: 44,
  padding: "10px 12px",
  fontSize: 15,
  border: `1px solid ${palette.border}`,
  borderRadius: 0,
  background: palette.surface,
  color: palette.ink,
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 120,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 14,
  lineHeight: 1.4,
  resize: "vertical",
};

const cardStyle: React.CSSProperties = {
  border: `1px solid ${palette.border}`,
  background: palette.surface,
  padding: 16,
  marginBottom: 16,
};

type Sbar = {
  patient: string;
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  actions: string[];
};

type DraftRow = {
  id: string;
  title: string;
  patient: string;
  updated_at: string;
};

const EMPTY_SBAR: Sbar = {
  patient: "",
  situation: "",
  background: "",
  assessment: "",
  recommendation: "",
  actions: [],
};

function parseSummary(text: string): Sbar {
  const sections: Record<string, string> = {};
  const headers = [
    "PATIENT",
    "SITUATION",
    "BACKGROUND",
    "ASSESSMENT",
    "RECOMMENDATION",
    "ACTION ITEMS",
  ];
  const pattern = new RegExp(`^\\s*\\**\\s*(${headers.join("|")})\\s*\\**\\s*:?\\s*$`, "i");
  const lines = text.split(/\r?\n/);
  let current: string | null = null;
  for (const raw of lines) {
    const line = raw.replace(/^\s*[#>*-]+\s*/, "");
    const m =
      line.match(pattern) ||
      raw.match(
        /^\s*\**\s*(PATIENT|SITUATION|BACKGROUND|ASSESSMENT|RECOMMENDATION|ACTION ITEMS)\s*\**\s*:/i,
      );
    if (m) {
      current = m[1].toUpperCase();
      sections[current] = "";
      const inline = raw.split(/:(.+)/s)[1];
      if (inline) sections[current] = inline.trim();
      continue;
    }
    if (current) sections[current] += (sections[current] ? "\n" : "") + raw;
  }
  const actionsText = (sections["ACTION ITEMS"] || "").trim();
  const actions = actionsText
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
  return {
    patient: (sections["PATIENT"] || "").trim(),
    situation: (sections["SITUATION"] || "").trim(),
    background: (sections["BACKGROUND"] || "").trim(),
    assessment: (sections["ASSESSMENT"] || "").trim(),
    recommendation: (sections["RECOMMENDATION"] || "").trim(),
    actions,
  };
}

type WebSpeechCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: unknown) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechCtor(): WebSpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: WebSpeechCtor;
    webkitSpeechRecognition?: WebSpeechCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function VoiceScreen({
  sb,
  userId,
  onBack,
}: {
  sb: SupabaseClient;
  userId: string;
  onBack: () => void;
}) {
  const speechCtor = getSpeechCtor();
  const speechSupported = speechCtor !== null;

  const [context, setContext] = useState("");
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [recording, setRecording] = useState(false);
  const [sbar, setSbar] = useState<Sbar>(EMPTY_SBAR);
  const [hasSummary, setHasSummary] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateErr, setGenerateErr] = useState<string | null>(null);
  const [newAction, setNewAction] = useState("");

  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [draftsErr, setDraftsErr] = useState<string | null>(null);

  const recognitionRef = useRef<ReturnType<WebSpeechCtor> | null>(null);
  const finalRef = useRef("");

  // Hard guarantee: never leave a session running across unmount.
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  const startRecording = useCallback(() => {
    console.log("[voice] start tapped");
    if (!speechCtor) {
      setGenerateErr(
        "Voice capture isn't available in this WebView. Type or paste a transcript below.",
      );
      return;
    }
    if (recording) return;
    try {
      const rec = new speechCtor();
      rec.lang =
        (typeof navigator !== "undefined" && navigator.language) || "en-US";
      rec.continuous = true;
      rec.interimResults = true;
      finalRef.current = transcript ? transcript + " " : "";
      let lastInterim = "";
      rec.onresult = (ev: unknown) => {
        const e = ev as {
          resultIndex: number;
          results: ArrayLike<
            ArrayLike<{ transcript: string }> & { isFinal: boolean }
          >;
        };
        let interimText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          const text = res[0].transcript;
          if (res.isFinal) {
            finalRef.current += text + " ";
          } else {
            interimText += text;
          }
        }
        lastInterim = interimText;
        setTranscript(finalRef.current.trim());
        setInterim(interimText);
      };
      rec.onerror = (ev: unknown) => {
        const code = (ev as { error?: string })?.error ?? "unknown";
        console.error("[voice] recognition error", code);
        if (code !== "aborted" && code !== "no-speech") {
          setGenerateErr(`Recognition error: ${code}`);
        }
      };
      rec.onend = () => {
        if (lastInterim) {
          finalRef.current += lastInterim + " ";
          setTranscript(finalRef.current.trim());
        }
        setInterim("");
        setRecording(false);
        recognitionRef.current = null;
      };
      recognitionRef.current = rec;
      rec.start();
      setRecording(true);
      setGenerateErr(null);
    } catch (err) {
      console.error("[voice] failed to start recognition", err);
      setGenerateErr(
        err instanceof Error ? err.message : "Couldn't start recognition.",
      );
      setRecording(false);
    }
  }, [recording, speechCtor, transcript]);

  const stopRecording = useCallback(() => {
    console.log("[voice] stop tapped");
    try {
      recognitionRef.current?.stop();
    } catch (err) {
      console.error("[voice] stop failed", err);
    }
  }, []);

  const generate = useCallback(async () => {
    console.log("[voice] generate tapped");
    setGenerateErr(null);
    if (transcript.trim().length < 10) {
      setGenerateErr("Dictate or type at least a sentence first.");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await sb.functions.invoke("ai-handoff", {
        body: {
          task: "summarize_handoff",
          input: { transcript, context: context || undefined },
        },
      });
      if (error) {
        console.error("[voice] ai-handoff error", error);
        throw new Error(error.message ?? "AI request failed");
      }
      const env = data as {
        data?: { summary?: string };
        error?: { code?: string; message?: string };
      } | null;
      if (env?.error) {
        if (env.error.code === "entitlement_required") {
          throw new Error("AI summaries require an active subscription.");
        }
        throw new Error(env.error.message ?? "AI request failed");
      }
      const summary = env?.data?.summary;
      if (!summary) throw new Error("AI returned an empty response.");
      setSbar(parseSummary(summary));
      setHasSummary(true);
    } catch (err) {
      console.error("[voice] generate failed", err);
      setGenerateErr(err instanceof Error ? err.message : "Couldn't generate summary.");
    } finally {
      setGenerating(false);
    }
  }, [context, sb, transcript]);

  const clearAll = useCallback(() => {
    console.log("[voice] clear tapped");
    setTranscript("");
    setInterim("");
    setSbar(EMPTY_SBAR);
    setHasSummary(false);
    setNewAction("");
    setDraftId(null);
    setDraftTitle("");
    setSaveErr(null);
    setGenerateErr(null);
    finalRef.current = "";
  }, []);

  const updateField = useCallback(
    <K extends keyof Omit<Sbar, "actions">>(key: K, value: string) => {
      setSbar((s) => ({ ...s, [key]: value }));
    },
    [],
  );

  const updateAction = useCallback((i: number, value: string) => {
    setSbar((s) => ({
      ...s,
      actions: s.actions.map((a, idx) => (idx === i ? value : a)),
    }));
  }, []);

  const removeAction = useCallback((i: number) => {
    setSbar((s) => ({ ...s, actions: s.actions.filter((_, idx) => idx !== i) }));
  }, []);

  const addAction = useCallback(() => {
    const v = newAction.trim();
    if (!v) return;
    setSbar((s) => ({ ...s, actions: [...s.actions, v] }));
    setNewAction("");
  }, [newAction]);

  const saveDraft = useCallback(async () => {
    console.log("[voice] save draft tapped");
    setSaveErr(null);
    const title =
      draftTitle.trim() ||
      (sbar.patient.trim()
        ? `Handoff — ${sbar.patient.trim().slice(0, 60)}`
        : "Untitled handoff");
    setSavingDraft(true);
    const payload = {
      user_id: userId,
      title,
      context,
      transcript,
      patient: sbar.patient,
      situation: sbar.situation,
      background: sbar.background,
      assessment: sbar.assessment,
      recommendation: sbar.recommendation,
      actions: sbar.actions,
    };
    try {
      if (draftId) {
        const { error } = await sb
          .from("handoff_drafts")
          .update(payload)
          .eq("id", draftId);
        if (error) {
          console.error("[voice] update draft failed", error);
          throw new Error(error.message);
        }
      } else {
        const { data, error } = await sb
          .from("handoff_drafts")
          .insert(payload)
          .select("id")
          .single();
        if (error) {
          console.error("[voice] insert draft failed", error);
          throw new Error(error.message);
        }
        setDraftId(data.id as string);
      }
      setDraftTitle(title);
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : "Couldn't save draft.");
    } finally {
      setSavingDraft(false);
    }
  }, [context, draftId, draftTitle, sb, sbar, transcript, userId]);

  const loadDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    setDraftsErr(null);
    try {
      const { data, error } = await sb
        .from("handoff_drafts")
        .select("id,title,patient,updated_at")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) {
        console.error("[voice] load drafts failed", error);
        throw new Error(error.message);
      }
      const rows = Array.isArray(data) ? data : [];
      setDrafts(
        rows
          .filter(
            (r): r is DraftRow =>
              !!r &&
              typeof (r as DraftRow).id === "string" &&
              typeof (r as DraftRow).title === "string",
          )
          .map((r) => ({
            id: r.id,
            title: r.title,
            patient: typeof r.patient === "string" ? r.patient : "",
            updated_at:
              typeof r.updated_at === "string" ? r.updated_at : new Date().toISOString(),
          })),
      );
    } catch (err) {
      setDraftsErr(err instanceof Error ? err.message : "Couldn't load drafts.");
    } finally {
      setLoadingDrafts(false);
    }
  }, [sb]);

  const openDraft = useCallback(
    async (id: string) => {
      console.log("[voice] open draft", id);
      try {
        const { data, error } = await sb
          .from("handoff_drafts")
          .select("*")
          .eq("id", id)
          .single();
        if (error) throw new Error(error.message);
        if (!data) throw new Error("Draft is missing.");
        const d = data as Record<string, unknown>;
        setDraftId(typeof d.id === "string" ? d.id : null);
        setDraftTitle(typeof d.title === "string" ? d.title : "");
        setContext(typeof d.context === "string" ? d.context : "");
        const t = typeof d.transcript === "string" ? d.transcript : "";
        setTranscript(t);
        finalRef.current = t + " ";
        setSbar({
          patient: typeof d.patient === "string" ? d.patient : "",
          situation: typeof d.situation === "string" ? d.situation : "",
          background: typeof d.background === "string" ? d.background : "",
          assessment: typeof d.assessment === "string" ? d.assessment : "",
          recommendation: typeof d.recommendation === "string" ? d.recommendation : "",
          actions: Array.isArray(d.actions)
            ? (d.actions as unknown[]).filter((a): a is string => typeof a === "string")
            : [],
        });
        setHasSummary(true);
        setDraftsOpen(false);
      } catch (err) {
        console.error("[voice] open draft failed", err);
        setDraftsErr(err instanceof Error ? err.message : "Couldn't open draft.");
      }
    },
    [sb],
  );

  const deleteDraft = useCallback(
    async (id: string) => {
      console.log("[voice] delete draft", id);
      try {
        const { error } = await sb.from("handoff_drafts").delete().eq("id", id);
        if (error) throw new Error(error.message);
        setDrafts((d) => d.filter((x) => x.id !== id));
        if (draftId === id) {
          setDraftId(null);
          setDraftTitle("");
        }
      } catch (err) {
        console.error("[voice] delete draft failed", err);
        setDraftsErr(err instanceof Error ? err.message : "Couldn't delete draft.");
      }
    },
    [draftId, sb],
  );

  return (
    <main style={pageStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button type="button" onClick={onBack} style={{ ...buttonBase, minHeight: 36, padding: "0 12px" }}>
          ← Back
        </button>
        <button
          type="button"
          onClick={() => {
            const next = !draftsOpen;
            setDraftsOpen(next);
            if (next) void loadDrafts();
          }}
          style={{ ...buttonBase, minHeight: 36, padding: "0 12px" }}
        >
          {draftsOpen ? "Close drafts" : "My drafts"}
        </button>
      </div>

      <h1 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 700 }}>Voice handoff</h1>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: palette.muted }}>
        Dictate or type, then generate an SBAR summary.
      </p>

      {draftsOpen && (
        <div style={cardStyle}>
          <h2 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>Saved drafts</h2>
          {loadingDrafts ? (
            <p style={{ fontSize: 13, color: palette.muted }}>Loading…</p>
          ) : draftsErr ? (
            <p style={{ fontSize: 13, color: palette.critical }}>{draftsErr}</p>
          ) : drafts.length === 0 ? (
            <p style={{ fontSize: 13, color: palette.muted }}>No drafts yet.</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {drafts.map((d) => (
                <li
                  key={d.id}
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: "10px 0",
                    borderBottom: `1px solid #eee`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => openDraft(d.id)}
                    style={{
                      flex: 1,
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      color: palette.ink,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{d.title}</div>
                    <div style={{ fontSize: 12, color: palette.muted }}>
                      {d.patient || "—"} · {new Date(d.updated_at).toLocaleString()}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteDraft(d.id)}
                    style={{ ...buttonBase, minHeight: 36, padding: "0 10px", color: palette.critical }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>1. Dictate</h2>
        {!speechSupported && (
          <p style={{ fontSize: 12, color: palette.muted, margin: "0 0 10px" }}>
            Voice capture isn't available in this WebView — type or paste below.
          </p>
        )}

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
          Optional context
        </label>
        <input
          type="text"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="e.g. Ward 4B, night shift, bed 12"
          style={{ ...inputStyle, marginBottom: 12 }}
        />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {!recording ? (
            <button
              type="button"
              onClick={startRecording}
              disabled={!speechSupported}
              style={{
                ...buttonBase,
                background: speechSupported ? palette.ink : "#ddd",
                color: speechSupported ? palette.surface : palette.muted,
                cursor: speechSupported ? "pointer" : "not-allowed",
              }}
            >
              ● Start recording
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              style={{ ...buttonBase, background: palette.critical, color: palette.surface }}
            >
              ■ Stop
            </button>
          )}
          <button type="button" onClick={clearAll} style={buttonBase}>
            Clear
          </button>
          {recording && (
            <span style={{ alignSelf: "center", fontSize: 13, color: palette.critical }}>
              ● Listening…
            </span>
          )}
        </div>

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
          Transcript
        </label>
        <textarea
          value={transcript + (interim ? (transcript ? " " : "") + interim : "")}
          onChange={(e) => {
            setTranscript(e.target.value);
            finalRef.current = e.target.value + " ";
            setInterim("");
          }}
          placeholder={speechSupported ? "Your speech will appear here…" : "Paste a transcript here…"}
          style={textareaStyle}
        />
        <p style={{ fontSize: 11, color: palette.muted, margin: "4px 0 0" }}>
          {transcript.length} chars
        </p>
      </div>

      <div style={cardStyle}>
        <h2 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>2. Summarize</h2>
        <button
          type="button"
          onClick={generate}
          style={{
            ...buttonBase,
            background: palette.accent,
            color: palette.surface,
            opacity: generating || recording ? 0.6 : 1,
          }}
        >
          {generating ? "Generating…" : hasSummary ? "Regenerate summary" : "Generate summary"}
        </button>
        {generateErr && (
          <p style={{ fontSize: 13, color: palette.critical, margin: "10px 0 0" }}>{generateErr}</p>
        )}
      </div>

      {hasSummary && (
        <div style={cardStyle}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>3. Edit SBAR</h2>

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Patient
          </label>
          <input
            type="text"
            value={sbar.patient}
            onChange={(e) => updateField("patient", e.target.value)}
            style={{ ...inputStyle, marginBottom: 12 }}
          />

          {(
            [
              { key: "situation", label: "Situation" },
              { key: "background", label: "Background" },
              { key: "assessment", label: "Assessment" },
              { key: "recommendation", label: "Recommendation" },
            ] as const
          ).map(({ key, label }) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                {label}
              </label>
              <textarea
                value={sbar[key]}
                onChange={(e) => updateField(key, e.target.value)}
                style={{ ...textareaStyle, minHeight: 80 }}
              />
            </div>
          ))}

          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Action items
          </label>
          {sbar.actions.length === 0 && (
            <p style={{ fontSize: 12, color: palette.muted, margin: "0 0 8px" }}>
              No action items yet.
            </p>
          )}
          {sbar.actions.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input
                type="text"
                value={a}
                onChange={(e) => updateAction(i, e.target.value)}
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => removeAction(i)}
                style={{ ...buttonBase, minHeight: 44, padding: "0 12px" }}
              >
                ×
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input
              type="text"
              value={newAction}
              onChange={(e) => setNewAction(e.target.value)}
              placeholder="Add an action item…"
              style={inputStyle}
            />
            <button type="button" onClick={addAction} style={buttonBase}>
              Add
            </button>
          </div>

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid #eee` }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Draft title
            </label>
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="e.g. Bed 12 night handoff"
              style={{ ...inputStyle, marginBottom: 10 }}
            />
            <button
              type="button"
              onClick={saveDraft}
              style={{
                ...buttonBase,
                background: palette.ok,
                color: palette.surface,
                opacity: savingDraft ? 0.6 : 1,
              }}
            >
              {savingDraft ? "Saving…" : draftId ? "Update draft" : "Save draft"}
            </button>
            {saveErr && (
              <p style={{ fontSize: 13, color: palette.critical, margin: "10px 0 0" }}>{saveErr}</p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
