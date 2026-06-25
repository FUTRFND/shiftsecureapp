// AI service layer.
//
// Single client-side entry point for all AI features. Screens import from
// here; nothing else should call `supabase.functions.invoke()` directly for
// AI work. This is the only place that knows the edge function name, the
// envelope shape, retry semantics, and user-facing error messages.

import { supabase } from "@/integrations/supabase/client";

export type AIErrorCode =
  | "unauthorized"
  | "rate_limited"
  | "credits_exhausted"
  | "timeout"
  | "ai_unavailable"
  | "ai_failed"
  | "network"
  | "invalid_input"
  | "unknown";

export class AIError extends Error {
  constructor(
    public readonly code: AIErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "AIError";
  }
}

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_CLIENT_RETRIES = 1; // Edge function already retries upstream

type ServerEnvelope<T> = {
  data?: T;
  error?: { code: string; message: string };
  meta?: { requestId?: string };
};

const RETRYABLE_SERVER_CODES = new Set<string>([
  "rate_limited",
  "ai_unavailable",
  "timeout",
]);

function mapServerError(code: string): AIErrorCode {
  switch (code) {
    case "unauthorized":
    case "rate_limited":
    case "credits_exhausted":
    case "timeout":
    case "ai_unavailable":
    case "ai_failed":
    case "invalid_input":
      return code;
    case "transcript_too_short":
    case "transcript_too_long":
    case "invalid_context":
    case "invalid_body":
    case "unknown_task":
    case "invalid_model_hint":
      return "invalid_input";
    default:
      return "unknown";
  }
}

async function invokeAI<T>(
  task: string,
  input: unknown,
  modelHint?: "default" | "fast" | "quality",
): Promise<T> {
  let lastErr: AIError | undefined;
  for (let attempt = 0; attempt <= MAX_CLIENT_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
      const { data, error } = await supabase.functions.invoke<ServerEnvelope<T>>(
        "ai-handoff",
        {
          body: { task, input, modelHint },
        },
      );
      clearTimeout(timer);

      // FunctionsHttpError surfaces non-2xx; parse body for our envelope.
      if (error) {
        // @ts-expect-error - context.response exists on FunctionsHttpError
        const response: Response | undefined = error.context?.response ?? error.context;
        let envelope: ServerEnvelope<T> | undefined;
        if (response && typeof response.json === "function") {
          try {
            envelope = await response.json();
          } catch {
            // body wasn't JSON
          }
        }
        if (envelope?.error) {
          const code = mapServerError(envelope.error.code);
          const aiErr = new AIError(
            code,
            envelope.error.message,
            RETRYABLE_SERVER_CODES.has(envelope.error.code),
            envelope.meta?.requestId,
          );
          if (aiErr.retryable && attempt < MAX_CLIENT_RETRIES) {
            lastErr = aiErr;
            await delay(400 * (attempt + 1));
            continue;
          }
          throw aiErr;
        }
        // Generic transport failure (network, edge function crash, etc.)
        throw new AIError(
          "network",
          "Couldn't reach the AI service. Check your connection and try again.",
          true,
        );
      }

      if (!data || data.error) {
        const code = data?.error ? mapServerError(data.error.code) : "unknown";
        throw new AIError(
          code,
          data?.error?.message ?? "AI request failed.",
          data?.error ? RETRYABLE_SERVER_CODES.has(data.error.code) : false,
          data?.meta?.requestId,
        );
      }
      if (data.data === undefined) {
        throw new AIError("ai_failed", "AI returned an empty response.", true, data.meta?.requestId);
      }
      return data.data;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof AIError) {
        if (err.retryable && attempt < MAX_CLIENT_RETRIES) {
          lastErr = err;
          await delay(400 * (attempt + 1));
          continue;
        }
        throw err;
      }
      // AbortController-triggered timeout or thrown fetch error
      const isAbort = (err as Error)?.name === "AbortError";
      const aiErr = new AIError(
        isAbort ? "timeout" : "network",
        isAbort
          ? "The AI request took too long. Please try again."
          : "Couldn't reach the AI service. Check your connection and try again.",
        true,
      );
      if (attempt < MAX_CLIENT_RETRIES) {
        lastErr = aiErr;
        await delay(400 * (attempt + 1));
        continue;
      }
      throw aiErr;
    }
  }
  throw lastErr ?? new AIError("unknown", "AI request failed.", false);
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---- Public API ----------------------------------------------------------

export type SummarizeHandoffInput = {
  transcript: string;
  context?: string;
};

export type SummarizeHandoffResult = {
  summary: string;
};

export const aiService = {
  async summarizeHandoff(
    input: SummarizeHandoffInput,
    opts?: { modelHint?: "default" | "fast" | "quality" },
  ): Promise<SummarizeHandoffResult> {
    return invokeAI<SummarizeHandoffResult>("summarize_handoff", input, opts?.modelHint);
  },
};
