import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Copy,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  Mic,
  MicOff,
  Plus,
  Save,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { aiService, AIError } from "@/services/ai";
import { platformSpeech, SpeechError } from "@/platform/speech";
import { platformClipboard, ClipboardError } from "@/platform/clipboard";
import { platformHaptics } from "@/platform/haptics";
import { platformPermissions } from "@/platform/permissions";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { OfflineBanner } from "@/components/offline-banner";
import { useCapability } from "@/hooks/use-subscription";
import { Paywall } from "@/components/paywall";
import { Lock } from "lucide-react";

function VoiceErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-6">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <svg
            className="h-6 w-6 text-destructive"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A runtime error on this page stopped it from loading. You can try again or go back to
            the dashboard.
          </p>
        </div>
        {error.message && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
            <p className="text-xs font-mono text-destructive break-words">{error.message}</p>
          </div>
        )}
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="default"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link to="/dashboard">Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/voice")({
  head: () => ({ meta: [{ title: "Voice summary — ShiftSecure" }] }),
  component: VoicePage,
  errorComponent: VoiceErrorBoundary,
});

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

type SkippedDraft = {
  id: string | null;
  title: string | null;
  reason: string;
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
      // inline content after the colon
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

function formatSbar(s: Sbar): string {
  const actions = s.actions.length ? s.actions.map((a) => `- ${a}`).join("\n") : "(none)";
  return [
    `PATIENT: ${s.patient}`,
    ``,
    `SITUATION:\n${s.situation}`,
    ``,
    `BACKGROUND:\n${s.background}`,
    ``,
    `ASSESSMENT:\n${s.assessment}`,
    ``,
    `RECOMMENDATION:\n${s.recommendation}`,
    ``,
    `ACTION ITEMS:\n${actions}`,
  ].join("\n");
}

function VoicePage() {
  const network = useNetworkStatus();
  const [supported, setSupported] = useState(true);

  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [context, setContext] = useState("");
  const [sbar, setSbar] = useState<Sbar>(EMPTY_SBAR);
  const [hasSummary, setHasSummary] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [newAction, setNewAction] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const finalRef = useRef("");
  const recordingRef = useRef(false);
  const generationIdRef = useRef(0);
  const canUseAI = useCapability("ai.summarize");
  const [paywallOpen, setPaywallOpen] = useState(false);

  // Probe support once on mount through the platform layer (web Speech API or
  // native plugin) — no Web Speech API access in the component itself.
  useEffect(() => {
    let cancelled = false;
    void platformSpeech.isSupported().then((s) => {
      if (!cancelled) setSupported(s);
    });
    return () => {
      cancelled = true;
      // Hard guarantee: never leave a session running across navigation.
      void platformSpeech.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    if (!recordingRef.current) return;
    void platformSpeech.stop();
  }, []);

  const start = useCallback(async () => {
    if (recordingRef.current) return; // de-dupe rapid clicks

    if (!supported) {
      toast.error(
        "Voice capture isn't available on this device. You can paste a transcript below.",
      );
      return;
    }

    // Centralized permission flow — same shape on web and native.
    const granted = await platformPermissions.ensure("microphone");
    if (!granted) {
      toast.error("Microphone access is required. Enable it in your device settings.");
      return;
    }

    finalRef.current = transcript ? transcript + " " : "";
    recordingRef.current = true;
    setRecording(true);
    setInterim("");
    void platformHaptics.impact("light");

    let lastInterim = "";
    await platformSpeech.start({
      lang: typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US",
      silenceTimeoutMs: 4000,
      partialResults: true,
      onResult: ({ transcript: text, isFinal }) => {
        if (isFinal) {
          finalRef.current += text + " ";
          setTranscript(finalRef.current.trim());
          setInterim("");
          lastInterim = "";
        } else {
          setInterim(text);
          lastInterim = text;
        }
      },
      onError: (err: SpeechError) => {
        if (err.code === "aborted" || err.code === "no_speech") return;
        toast.error(err.message);
      },
      onEnd: () => {
        // Commit any trailing partial that never got finalized (common on
        // native, where the session ends without a final-callback).
        if (lastInterim) {
          finalRef.current += lastInterim + " ";
          setTranscript(finalRef.current.trim());
        }
        recordingRef.current = false;
        setRecording(false);
        setInterim("");
        void platformHaptics.impact("light");
      },
    });
  }, [supported, transcript]);

  async function generate() {
    if (transcript.trim().length < 10) {
      toast.error("Dictate at least a sentence or two first.");
      return;
    }
    if (!network.connected) {
      toast.error("You're offline. AI summary needs a connection.");
      return;
    }
    // Capability check: hidden gate. The server re-verifies independently
    // via RevenueCat — this is just UX so free users see the paywall instead
    // of a 402 error toast.
    if (!canUseAI) {
      setPaywallOpen(true);
      return;
    }
    // De-dupe overlapping requests: only the latest call writes to state.
    const requestId = ++generationIdRef.current;
    setGenerating(true);
    try {
      const { summary } = await aiService.summarizeHandoff({
        transcript,
        context: context || undefined,
      });
      if (requestId !== generationIdRef.current) return; // superseded
      setSbar(parseSummary(summary));
      setHasSummary(true);
      void platformHaptics.notificationSuccess();
    } catch (err) {
      if (requestId !== generationIdRef.current) return;
      // Server enforced the paywall — open the upgrade flow instead of toasting.
      if (err instanceof AIError && err.code === "entitlement_required") {
        setPaywallOpen(true);
        void platformHaptics.notificationError();
        return;
      }
      const msg =
        err instanceof AIError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't generate summary";
      toast.error(msg);
      void platformHaptics.notificationError();
    } finally {
      if (requestId === generationIdRef.current) setGenerating(false);
    }
  }

  async function copy(text: string) {
    try {
      await platformClipboard.write(text);
      toast.success("Copied to clipboard");
      void platformHaptics.impact("light");
    } catch (err) {
      const msg = err instanceof ClipboardError ? err.message : "Couldn't copy to the clipboard.";
      toast.error(msg);
    }
  }

  function reset() {
    setTranscript("");
    setInterim("");
    setSbar(EMPTY_SBAR);
    setHasSummary(false);
    setNewAction("");
    setDraftId(null);
    setDraftTitle("");
    finalRef.current = "";
  }

  async function saveDraft() {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      toast.error("You must be signed in to save drafts.");
      return;
    }
    const title =
      draftTitle.trim() ||
      (sbar.patient.trim() ? `Handoff — ${sbar.patient.trim().slice(0, 60)}` : "Untitled handoff");
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
        const { error } = await supabase.from("handoff_drafts").update(payload).eq("id", draftId);
        if (error) throw error;
        toast.success("Draft updated");
        void platformHaptics.notificationSuccess();
      } else {
        const { data, error } = await supabase
          .from("handoff_drafts")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        setDraftId(data.id);
        toast.success("Draft saved");
        void platformHaptics.notificationSuccess();
      }
      setDraftTitle(title);
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Couldn't save draft");
    } finally {
      setSavingDraft(false);
    }
  }

  const [draftsError, setDraftsError] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<SkippedDraft[]>([]);

  function validateDraftRow(
    row: unknown,
  ): { ok: true; row: DraftRow } | { ok: false; skipped: SkippedDraft } {
    const r = (row && typeof row === "object" ? (row as Record<string, unknown>) : null) ?? {};
    const id = typeof r.id === "string" && r.id ? r.id : null;
    const reasons: string[] = [];
    if (!row || typeof row !== "object") {
      reasons.push("row is not an object");
    } else {
      if (typeof r.id !== "string" || !r.id) reasons.push("missing id");
      if (typeof r.title !== "string") reasons.push("invalid title");
      if (typeof r.patient !== "string") reasons.push("invalid patient");
      if (typeof r.updated_at !== "string") reasons.push("invalid timestamp");
    }
    if (reasons.length === 0) return { ok: true, row: row as DraftRow };
    return {
      ok: false,
      skipped: {
        id,
        title: typeof r.title === "string" ? r.title : null,
        reason: reasons.join(", "),
      },
    };
  }

  async function loadDrafts() {
    setLoadingDrafts(true);
    setDraftsError(null);
    setSkipped([]);
    try {
      const { data, error } = await supabase
        .from("handoff_drafts")
        .select("id,title,patient,updated_at")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      const valid: DraftRow[] = [];
      const skippedRows: SkippedDraft[] = [];
      for (const r of rows) {
        const res = validateDraftRow(r);
        if (res.ok) valid.push(res.row);
        else skippedRows.push(res.skipped);
      }
      setSkipped(skippedRows);
      setDrafts(valid);
    } catch (err) {
      const msg = (err as { message?: string })?.message ?? "Couldn't load drafts";
      setDraftsError(msg);
      toast.error(msg);
    } finally {
      setLoadingDrafts(false);
    }
  }

  async function deleteSkipped(id: string) {
    try {
      const { error } = await supabase.from("handoff_drafts").delete().eq("id", id);
      if (error) throw error;
      setSkipped((s) => s.filter((x) => x.id !== id));
      toast.success("Corrupted draft deleted");
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Couldn't delete draft");
    }
  }

  async function openDraft(id: string) {
    try {
      const { data, error } = await supabase
        .from("handoff_drafts")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      if (!data || typeof data !== "object") {
        throw new Error("Draft data is missing or unreadable.");
      }
      if (typeof data.id !== "string") {
        throw new Error("This draft appears to be corrupted and can't be opened.");
      }
      setDraftId(data.id);
      setDraftTitle(typeof data.title === "string" ? data.title : "");
      setContext(typeof data.context === "string" ? data.context : "");
      setTranscript(typeof data.transcript === "string" ? data.transcript : "");
      finalRef.current = (typeof data.transcript === "string" ? data.transcript : "") + " ";
      setSbar({
        patient: typeof data.patient === "string" ? data.patient : "",
        situation: typeof data.situation === "string" ? data.situation : "",
        background: typeof data.background === "string" ? data.background : "",
        assessment: typeof data.assessment === "string" ? data.assessment : "",
        recommendation: typeof data.recommendation === "string" ? data.recommendation : "",
        actions: Array.isArray(data.actions)
          ? (data.actions as any[]).filter((a): a is string => typeof a === "string")
          : [],
      });
      setHasSummary(true);
      setDraftsOpen(false);
      toast.success("Draft loaded");
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Couldn't open draft");
    }
  }

  async function deleteDraft(id: string) {
    try {
      const { error } = await supabase.from("handoff_drafts").delete().eq("id", id);
      if (error) throw error;
      setDrafts((d) => d.filter((x) => x.id !== id));
      if (draftId === id) {
        setDraftId(null);
        setDraftTitle("");
      }
      toast.success("Draft deleted");
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Couldn't delete draft");
    }
  }

  function updateField<K extends keyof Omit<Sbar, "actions">>(key: K, value: string) {
    setSbar((s) => ({ ...s, [key]: value }));
  }
  function updateAction(i: number, value: string) {
    setSbar((s) => ({ ...s, actions: s.actions.map((a, idx) => (idx === i ? value : a)) }));
  }
  function removeAction(i: number) {
    setSbar((s) => ({ ...s, actions: s.actions.filter((_, idx) => idx !== i) }));
  }
  function addAction() {
    const v = newAction.trim();
    if (!v) return;
    setSbar((s) => ({ ...s, actions: [...s.actions, v] }));
    setNewAction("");
  }

  function saveHandoff() {
    const text = formatSbar(sbar);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.href = url;
    a.download = `sbar-handoff-${stamp}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("SBAR handoff saved");
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
              <Sparkles className="h-5 w-5 text-primary" />
              Voice summary
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog
              open={draftsOpen}
              onOpenChange={(o) => {
                setDraftsOpen(o);
                if (o) loadDrafts();
              }}
            >
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <FolderOpen className="h-4 w-4" /> My drafts
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Saved handoff drafts</DialogTitle>
                  <DialogDescription>Pick a draft to reload it into the editor.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] pr-2">
                  {skipped.length > 0 && (
                    <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                      <div className="text-sm font-medium text-destructive">
                        {skipped.length} draft{skipped.length === 1 ? "" : "s"} skipped
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        These rows couldn't be read safely. You can delete corrupted ones below.
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {skipped.map((s, i) => (
                          <li
                            key={s.id ?? `skip-${i}`}
                            className="flex items-start justify-between gap-2 rounded border border-destructive/20 bg-background/60 p-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium truncate">
                                {s.title || "(untitled)"}
                              </div>
                              <div className="text-[11px] text-muted-foreground break-words">
                                {s.reason}
                                {!s.id && " · no id, can't auto-delete"}
                              </div>
                            </div>
                            {s.id && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteSkipped(s.id!)}
                                aria-label="Delete corrupted draft"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {draftsError ? (
                    <div className="py-8 text-center text-sm text-destructive">
                      <p className="font-medium">Couldn't load drafts</p>
                      <p className="text-muted-foreground mt-1">{draftsError}</p>
                    </div>
                  ) : loadingDrafts ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
                    </div>
                  ) : drafts.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      <FileText className="h-6 w-6 mx-auto mb-2 opacity-50" />
                      No drafts saved yet.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {drafts.map((d) => (
                        <li
                          key={d.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 p-3 hover:bg-muted/60"
                        >
                          <button className="flex-1 text-left" onClick={() => openDraft(d.id)}>
                            <div className="font-medium text-sm truncate">{d.title}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {d.patient || "—"} · {new Date(d.updated_at).toLocaleString()}
                            </div>
                          </button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteDraft(d.id)}
                            aria-label="Delete draft"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </ScrollArea>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDraftsOpen(false)}>
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Badge variant={supported ? "secondary" : "outline"}>
              {supported ? "Mic ready" : "Mic unsupported"}
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-6">
        <OfflineBanner message="You're offline. Recording works, but generating the AI summary needs a connection." />
        <div>
          <p className="text-sm uppercase tracking-wider text-muted-foreground">
            Dictate &amp; structure
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Voice-to-text handoff summary
          </h1>
          <p className="mt-1 text-muted-foreground">
            Dictate freely, then let AI turn it into a structured SBAR handoff.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. Dictate</CardTitle>
            <CardDescription>
              {supported
                ? "Click Start, speak naturally, and stop when finished. You can edit the transcript before generating."
                : "Voice capture requires Chrome, Edge or Safari. You can also paste a transcript below."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="ctx">Optional context (patient, shift, ward)</Label>
              <Input
                id="ctx"
                placeholder="e.g. Ward 4B, night shift, bed 12"
                value={context}
                onChange={(e) => setContext(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {!recording ? (
                <Button onClick={start} disabled={!supported}>
                  <Mic className="h-4 w-4" /> Start recording
                </Button>
              ) : (
                <Button onClick={stop} variant="destructive">
                  <Square className="h-4 w-4" /> Stop
                </Button>
              )}
              <Button
                variant="outline"
                onClick={reset}
                disabled={recording || (!transcript && !hasSummary)}
              >
                <Trash2 className="h-4 w-4" /> Clear
              </Button>
              {recording && (
                <span className="flex items-center gap-2 text-sm text-destructive">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
                  </span>
                  Listening…
                </span>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transcript">Transcript</Label>
              <Textarea
                id="transcript"
                rows={8}
                placeholder={
                  supported ? "Your speech will appear here…" : "Paste a transcript here…"
                }
                value={transcript + (interim ? (transcript ? " " : "") + interim : "")}
                onChange={(e) => {
                  setTranscript(e.target.value);
                  finalRef.current = e.target.value + " ";
                  setInterim("");
                }}
                className="font-mono text-sm"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{transcript.length} chars</span>
                {transcript && (
                  <button className="hover:text-foreground" onClick={() => copy(transcript)}>
                    <Copy className="inline h-3 w-3" /> Copy transcript
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> 2. Generate structured summary
            </CardTitle>
            <CardDescription>
              AI rewrites your dictation into an SBAR handoff with action items. Tweak any field
              before saving.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              onClick={generate}
              disabled={generating || recording || transcript.trim().length < 10}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                </>
              ) : !canUseAI ? (
                <>
                  <Lock className="h-4 w-4" /> Unlock AI summaries
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />{" "}
                  {hasSummary ? "Regenerate summary" : "Generate summary"}
                </>
              )}
            </Button>

            {!supported && !hasSummary && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <MicOff className="h-3.5 w-3.5" /> Browser mic capture unavailable — you can still
                paste a transcript above.
              </p>
            )}
          </CardContent>
        </Card>

        {hasSummary && (
          <Card>
            <CardHeader>
              <CardTitle>3. Edit SBAR handoff</CardTitle>
              <CardDescription>
                Refine each section before saving or sharing with the next shift.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="sbar-patient">Patient</Label>
                <Input
                  id="sbar-patient"
                  value={sbar.patient}
                  onChange={(e) => updateField("patient", e.target.value)}
                  placeholder="e.g. Bed 12, J. Doe, 68F"
                />
              </div>

              {(
                [
                  { key: "situation", label: "Situation", rows: 3 },
                  { key: "background", label: "Background", rows: 4 },
                  { key: "assessment", label: "Assessment", rows: 4 },
                  { key: "recommendation", label: "Recommendation", rows: 3 },
                ] as const
              ).map(({ key, label, rows }) => (
                <div key={key} className="grid gap-2">
                  <Label htmlFor={`sbar-${key}`}>{label}</Label>
                  <Textarea
                    id={`sbar-${key}`}
                    rows={rows}
                    value={sbar[key]}
                    onChange={(e) => updateField(key, e.target.value)}
                  />
                </div>
              ))}

              <div className="grid gap-2">
                <Label>Action items</Label>
                <div className="space-y-2">
                  {sbar.actions.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No action items yet — add one below.
                    </p>
                  )}
                  {sbar.actions.map((a, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="mt-2 text-xs text-muted-foreground w-5 text-right">
                        {i + 1}.
                      </span>
                      <Textarea
                        rows={1}
                        value={a}
                        onChange={(e) => updateAction(i, e.target.value)}
                        className="min-h-9 flex-1"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeAction(i)}
                        aria-label="Remove action item"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 pt-1">
                  <Input
                    value={newAction}
                    placeholder="Add an action item…"
                    onChange={(e) => setNewAction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addAction();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addAction}
                    disabled={!newAction.trim()}
                  >
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 pt-2 border-t border-border/60">
                <Label htmlFor="draft-title">Draft title</Label>
                <Input
                  id="draft-title"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="e.g. Bed 12 night handoff"
                />
                {draftId && (
                  <p className="text-xs text-muted-foreground">
                    Editing saved draft — Save draft will overwrite it.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => copy(formatSbar(sbar))}>
                  <Copy className="h-4 w-4" /> Copy SBAR
                </Button>
                <Button variant="outline" onClick={saveHandoff}>
                  <Download className="h-4 w-4" /> Download .txt
                </Button>
                <Button onClick={saveDraft} disabled={savingDraft}>
                  {savingDraft ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}{" "}
                  {draftId ? "Update draft" : "Save draft"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
      <Paywall
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        capability="ai.summarize"
        featureTitle="AI summaries are a Pro feature"
        featureDescription="Subscribe to generate structured SBAR handoffs from your dictation."
        onUnlocked={() => void generate()}
      />
    </div>
  );
}
