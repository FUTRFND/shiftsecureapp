// Native Voice screen — local state, plain HTML, no router/UI libs.
// Uses platformSpeech (Capacitor SpeechRecognition on iOS/Android, Web Speech
// API on web with manual fallback). Calls the ai-handoff edge function.
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  Banner,
  Card,
  EmptyState,
  Pill,
  ScreenHeader,
  SectionHeader,
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
  textareaStyle as baseTextareaStyle,
  useConfirm,
  useKeyboardScrollIntoView,
} from "./ui";
import { platformSpeech, SpeechError } from "@/platform/speech";

const monoTextareaStyle: React.CSSProperties = {
  ...baseTextareaStyle,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 14,
  lineHeight: 1.4,
  minHeight: 140,
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

// Speech is provided by platformSpeech (native or web). The screen tracks
// `baseTranscript` (committed text) and `interim` (live partial) separately.

function StepBadge({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 24,
        height: 24,
        borderRadius: 999,
        background: palette.accentSoft,
        color: palette.accentDeep,
        fontSize: 12,
        fontWeight: 800,
        marginRight: 8,
      }}
    >
      {n}
    </span>
  );
}

export function VoiceScreen({
  sb,
  userId,
  onBack: _onBack,
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
  useKeyboardScrollIntoView();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const recognitionRef = useRef<InstanceType<WebSpeechCtor> | null>(null);
  const finalRef = useRef("");

  // Inject the recording-pulse keyframes once.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById("mobile-voice-anim")) return;
    const el = document.createElement("style");
    el.id = "mobile-voice-anim";
    el.textContent = `
@keyframes mobile-voice-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(215,38,61,0.55); }
  70%  { box-shadow: 0 0 0 18px rgba(215,38,61,0); }
  100% { box-shadow: 0 0 0 0 rgba(215,38,61,0); }
}
.mobile-voice-pulse { animation: mobile-voice-pulse 1.4s ease-out infinite; }
`;
    document.head.appendChild(el);
  }, []);

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
    const FN = "ai-handoff";
    console.log("[voice] generate tapped → function:", FN);
    setGenerateErr(null);
    if (transcript.trim().length < 10) {
      setGenerateErr("Dictate or type at least a sentence first.");
      return;
    }
    setGenerating(true);
    try {
      // Resolve session + URL up front so we can log auth presence.
      const { data: sessionData, error: sessionErr } = await sb.auth.getSession();
      if (sessionErr) console.error(`[voice] ${FN} session error`, sessionErr);
      const session = sessionData?.session ?? null;
      const accessToken = session?.access_token ?? null;
      console.log(`[voice] ${FN} session present:`, !!session, "user:", session?.user?.id ?? null);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
      console.log(`[voice] ${FN} env present:`, {
        VITE_SUPABASE_URL: !!supabaseUrl,
        VITE_SUPABASE_PUBLISHABLE_KEY: !!anonKey,
      });
      if (!supabaseUrl || !anonKey) {
        throw new Error("App is missing Supabase configuration (URL or publishable key).");
      }
      if (!accessToken) {
        throw new Error("You're signed out. Please sign in again to generate a summary.");
      }

      const url = `${supabaseUrl}/functions/v1/${FN}`;
      const payload = {
        task: "summarize_handoff" as const,
        input: { transcript, context: context || undefined },
      };
      console.log(`[voice] ${FN} POST`, url);

      let resp: Response;
      try {
        resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            apikey: anonKey,
          },
          body: JSON.stringify(payload),
        });
      } catch (netErr) {
        console.error(`[voice] ${FN} network failure`, netErr);
        throw new Error(
          `Couldn't reach the AI service (network error: ${
            netErr instanceof Error ? netErr.message : String(netErr)
          }). Check your connection and try again.`,
        );
      }

      console.log(`[voice] ${FN} response status:`, resp.status, resp.statusText);

      const rawText = await resp.text();
      let parsed: unknown = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch (parseErr) {
        console.error(`[voice] ${FN} non-JSON response body:`, rawText);
        console.error(`[voice] ${FN} JSON parse error`, parseErr);
      }
      console.log(`[voice] ${FN} response body:`, parsed ?? rawText);

      if (!resp.ok) {
        const env = parsed as
          | { error?: { code?: string; message?: string }; message?: string; code?: string }
          | null;
        const code = env?.error?.code ?? env?.code;
        const msg = env?.error?.message ?? env?.message;
        if (resp.status === 404) {
          throw new Error(
            `AI function "${FN}" is not deployed. Open the Supabase project and deploy the ai-handoff edge function, then try again.`,
          );
        }
        if (resp.status === 401) {
          throw new Error(msg ?? "You're signed out. Please sign in again.");
        }
        if (code === "entitlement_required") {
          throw new Error("AI summaries require an active subscription.");
        }
        throw new Error(msg ?? `AI request failed (HTTP ${resp.status} ${resp.statusText}).`);
      }

      const env = parsed as {
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

  const clearAll = useCallback(async () => {
    if (transcript || hasSummary) {
      const ok = await confirm({
        title: "Clear current handoff?",
        body: "Your transcript and summary will be removed from this screen. Saved drafts are kept.",
        confirmLabel: "Clear",
        destructive: true,
      });
      if (!ok) return;
    }
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
  }, [confirm, hasSummary, transcript]);

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
    async (id: string, title: string) => {
      const ok = await confirm({
        title: `Delete "${title || "this draft"}"?`,
        body: "This handoff draft will be removed from your account.",
        confirmLabel: "Delete",
        destructive: true,
      });
      if (!ok) return;
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
    [confirm, draftId, sb],
  );

  const liveTranscript =
    transcript + (interim ? (transcript ? " " : "") + interim : "");
  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

  return (
    <main style={pageStyle}>
      <ScreenHeader
        title="Voice handoff"
        subtitle="Dictate or type, then generate an SBAR summary."
        right={
          <button
            type="button"
            onClick={() => {
              const next = !draftsOpen;
              setDraftsOpen(next);
              if (next) void loadDrafts();
            }}
            className="mobile-tap"
            style={{
              ...ghostButton,
              minHeight: 36,
              padding: "0 12px",
              fontSize: 13,
              borderRadius: radii.pill,
            }}
          >
            {draftsOpen ? "Close" : "Drafts"}
          </button>
        }
      />

      {draftsOpen && (
        <>
          <SectionHeader title="Saved drafts" />
          <Card>
            {loadingDrafts ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 16 }}>
                <Spinner label="Loading drafts…" />
              </div>
            ) : draftsErr ? (
              <Banner tone="error" onDismiss={() => setDraftsErr(null)}>
                {draftsErr}
              </Banner>
            ) : drafts.length === 0 ? (
              <EmptyState
                icon="✎"
                title="No drafts yet"
                body="Generate and save a summary to keep it here."
              />
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {drafts.map((d, idx) => (
                  <li
                    key={d.id}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      padding: "12px 0",
                      borderTop: idx === 0 ? "none" : `1px solid ${palette.hairline}`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => openDraft(d.id)}
                      className="mobile-tap"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        textAlign: "left",
                        background: "transparent",
                        border: "none",
                        color: palette.ink,
                        cursor: "pointer",
                        padding: 0,
                        font: "inherit",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {d.title}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: palette.muted,
                          marginTop: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {d.patient || "No patient"} ·{" "}
                        {new Date(d.updated_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteDraft(d.id, d.title)}
                      className="mobile-tap"
                      aria-label={`Delete ${d.title}`}
                      style={{
                        ...ghostButton,
                        minHeight: 36,
                        padding: "0 10px",
                        color: palette.critical,
                        borderColor: palette.criticalSoft,
                        fontSize: 13,
                      }}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <SectionHeader title="1 · Capture" />
      <Card>
        {!speechSupported && (
          <Banner tone="info">
            Voice capture isn't available in this WebView — type or paste the
            transcript below.
          </Banner>
        )}

        <label style={labelStyle}>Optional context</label>
        <input
          type="text"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="e.g. Ward 4B, night shift, bed 12"
          style={inputStyle}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            padding: `${space.md}px 0 ${space.sm}px`,
          }}
        >
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={!speechSupported && !recording}
            aria-label={recording ? "Stop recording" : "Start recording"}
            className={`mobile-tap ${recording ? "mobile-voice-pulse" : ""}`}
            style={{
              width: 84,
              height: 84,
              borderRadius: "50%",
              border: "none",
              background: recording
                ? palette.critical
                : speechSupported
                  ? `linear-gradient(135deg, ${palette.accent} 0%, ${palette.accentGlow} 100%)`
                  : palette.surfaceAlt,
              color: speechSupported || recording ? "#fff" : palette.subtle,
              fontSize: 30,
              fontWeight: 700,
              cursor: speechSupported || recording ? "pointer" : "not-allowed",
              boxShadow: recording ? "none" : shadow.primary,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              touchAction: "manipulation",
              transition: "background 160ms ease, transform 160ms ease",
            }}
          >
            {recording ? "■" : "●"}
          </button>
          <Pill tone={recording ? "critical" : speechSupported ? "accent" : "neutral"} dot={recording}>
            {recording
              ? "Listening…"
              : speechSupported
                ? "Tap to record"
                : "Recording unavailable"}
          </Pill>
        </div>

        <label style={{ ...labelStyle, marginTop: space.sm }}>Transcript</label>
        <textarea
          value={liveTranscript}
          onChange={(e) => {
            setTranscript(e.target.value);
            finalRef.current = e.target.value + " ";
            setInterim("");
          }}
          placeholder={
            speechSupported
              ? "Your speech will appear here…"
              : "Paste a transcript here…"
          }
          style={monoTextareaStyle}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 4,
            fontSize: 12,
            color: palette.muted,
          }}
        >
          <span>
            {wordCount} word{wordCount === 1 ? "" : "s"} · {transcript.length} chars
          </span>
          <button
            type="button"
            onClick={clearAll}
            className="mobile-tap"
            style={{
              background: "transparent",
              border: "none",
              color: palette.muted,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            Clear
          </button>
        </div>
      </Card>

      <SectionHeader title="2 · Summarize" />
      <Card>
        <p
          style={{
            margin: `0 0 ${space.md}px`,
            fontSize: 13,
            color: palette.muted,
            lineHeight: 1.4,
          }}
        >
          Generate a structured SBAR (Situation, Background, Assessment,
          Recommendation) from the transcript above.
        </p>
        <button
          type="button"
          onClick={generate}
          disabled={generating || recording || transcript.trim().length < 10}
          className="mobile-tap"
          style={{
            ...primaryButton,
            width: "100%",
            opacity:
              generating || recording || transcript.trim().length < 10 ? 0.6 : 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {generating && <Spinner size={14} color="#fff" />}
          {generating
            ? "Generating…"
            : hasSummary
              ? "Regenerate summary"
              : "Generate summary"}
        </button>
        {generateErr && (
          <div style={{ marginTop: space.md }}>
            <Banner tone="error" onDismiss={() => setGenerateErr(null)}>
              {generateErr}
            </Banner>
          </div>
        )}
      </Card>

      {hasSummary && (
        <>
          <SectionHeader title="3 · Review SBAR" />
          <Card>
            <label style={labelStyle}>Patient</label>
            <input
              type="text"
              value={sbar.patient}
              onChange={(e) => updateField("patient", e.target.value)}
              style={inputStyle}
            />

            {(
              [
                { key: "situation", label: "Situation" },
                { key: "background", label: "Background" },
                { key: "assessment", label: "Assessment" },
                { key: "recommendation", label: "Recommendation" },
              ] as const
            ).map(({ key, label }) => (
              <div key={key}>
                <label style={labelStyle}>{label}</label>
                <textarea
                  value={sbar[key]}
                  onChange={(e) => updateField(key, e.target.value)}
                  style={{ ...baseTextareaStyle, minHeight: 90 }}
                />
              </div>
            ))}

            <label style={labelStyle}>Action items</label>
            {sbar.actions.length === 0 && (
              <p
                style={{
                  fontSize: 13,
                  color: palette.muted,
                  margin: `0 0 ${space.sm}px`,
                }}
              >
                No action items yet.
              </p>
            )}
            {sbar.actions.map((a, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "flex-start",
                  marginBottom: 6,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    flex: "0 0 auto",
                    width: 28,
                    height: 48,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    color: palette.accentDeep,
                  }}
                >
                  {i + 1}.
                </span>
                <input
                  type="text"
                  value={a}
                  onChange={(e) => updateAction(i, e.target.value)}
                  style={{ ...inputStyle, marginBottom: 0 }}
                />
                <button
                  type="button"
                  onClick={() => removeAction(i)}
                  aria-label="Remove action item"
                  className="mobile-tap"
                  style={{
                    ...ghostButton,
                    minHeight: 48,
                    padding: "0 12px",
                    color: palette.critical,
                    borderColor: palette.criticalSoft,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <input
                type="text"
                value={newAction}
                onChange={(e) => setNewAction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAction();
                  }
                }}
                placeholder="Add an action item…"
                style={{ ...inputStyle, marginBottom: 0 }}
              />
              <button
                type="button"
                onClick={addAction}
                disabled={!newAction.trim()}
                className="mobile-tap"
                style={{
                  ...buttonBase,
                  background: palette.accentSoft,
                  borderColor: palette.accentSoft,
                  color: palette.accentDeep,
                  opacity: newAction.trim() ? 1 : 0.6,
                  fontWeight: 700,
                }}
              >
                Add
              </button>
            </div>
          </Card>

          <SectionHeader title="Save" />
          <Card>
            <label style={labelStyle}>Draft title</label>
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="e.g. Bed 12 night handoff"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={saveDraft}
              disabled={savingDraft}
              className="mobile-tap"
              style={{
                ...primaryButton,
                width: "100%",
                opacity: savingDraft ? 0.7 : 1,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {savingDraft && <Spinner size={14} color="#fff" />}
              {savingDraft
                ? "Saving…"
                : draftId
                  ? "Update draft"
                  : "Save draft"}
            </button>
            {saveErr && (
              <div style={{ marginTop: space.md }}>
                <Banner tone="error" onDismiss={() => setSaveErr(null)}>
                  {saveErr}
                </Banner>
              </div>
            )}
            {draftId && !saveErr && !savingDraft && (
              <p
                style={{
                  margin: `${space.sm}px 0 0`,
                  fontSize: 12,
                  color: palette.ok,
                  textAlign: "center",
                  fontWeight: 600,
                }}
              >
                ✓ Saved to your drafts
              </p>
            )}
          </Card>
        </>
      )}
      {confirmDialog}
    </main>
  );
}
