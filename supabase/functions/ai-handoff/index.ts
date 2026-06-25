// AI handoff edge function.
//
// Single entry point for all client AI calls. Owns:
//   - JWT validation (verify_jwt = true in config.toml)
//   - Input validation
//   - Prompt construction
//   - Provider selection + retries
//   - Error normalization (no provider details leak to the client)
//   - Structured logging
//
// The mobile + web clients never know which AI provider is used.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type AIProvider, pickProvider, ProviderError } from "./providers.ts";
import { entitlementsGrant, getEntitlementsForUser } from "../_shared/revenuecat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Task = "summarize_handoff";

type RequestBody = {
  task: Task;
  input: {
    transcript: string;
    context?: string;
  };
  modelHint?: "default" | "fast" | "quality";
};

const MAX_TRANSCRIPT = 20000;
const MIN_TRANSCRIPT = 10;
const MAX_CONTEXT = 500;
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 3;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clientError(code: string, message: string, status = 400) {
  // Stable, public-facing error envelope. Never includes provider names,
  // model IDs, stack traces, or upstream payloads.
  return json(status, { error: { code, message } });
}

function validate(body: unknown): RequestBody {
  if (!body || typeof body !== "object")
    throw new ValidationError("invalid_body", "Request body is required.");
  const b = body as Record<string, unknown>;
  if (b.task !== "summarize_handoff")
    throw new ValidationError("unknown_task", "Unsupported AI task.");
  const input = b.input as Record<string, unknown> | undefined;
  if (!input || typeof input !== "object")
    throw new ValidationError("invalid_input", "Missing input payload.");
  const transcript = input.transcript;
  if (typeof transcript !== "string" || transcript.trim().length < MIN_TRANSCRIPT)
    throw new ValidationError("transcript_too_short", "Dictate at least a sentence or two first.");
  if (transcript.length > MAX_TRANSCRIPT)
    throw new ValidationError("transcript_too_long", "Transcript is too long.");
  const context = input.context;
  if (context !== undefined && (typeof context !== "string" || context.length > MAX_CONTEXT))
    throw new ValidationError("invalid_context", "Context is invalid.");
  const modelHint = b.modelHint;
  if (
    modelHint !== undefined &&
    modelHint !== "default" &&
    modelHint !== "fast" &&
    modelHint !== "quality"
  ) {
    throw new ValidationError("invalid_model_hint", "Invalid model hint.");
  }
  return {
    task: "summarize_handoff",
    input: { transcript, context: context as string | undefined },
    modelHint: modelHint as RequestBody["modelHint"],
  };
}

class ValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function buildHandoffMessages(input: RequestBody["input"]) {
  const system = `You are a clinical handoff assistant. Convert dictated free-form clinician notes into a clean, structured SBAR-style handoff. Be concise, factual, and never invent information. If a field is not mentioned, write "Not stated". Use plain text with section headers exactly:

PATIENT
SITUATION
BACKGROUND
ASSESSMENT
RECOMMENDATION
ACTION ITEMS (bulleted)`;
  const user = `${input.context ? `Context: ${input.context}\n\n` : ""}Dictated notes:\n"""${input.transcript}"""`;
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}

async function callWithRetry(
  provider: AIProvider,
  req: { messages: ReturnType<typeof buildHandoffMessages>; modelHint?: RequestBody["modelHint"] },
) {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await provider.complete(req, controller.signal);
    } catch (err) {
      lastErr = err;
      if (!(err instanceof ProviderError) || !err.retryable || attempt === MAX_ATTEMPTS) {
        throw err;
      }
      const backoffMs = 250 * Math.pow(2, attempt - 1) + Math.random() * 100;
      await new Promise((r) => setTimeout(r, backoffMs));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

function mapProviderError(err: ProviderError): Response {
  switch (err.code) {
    case "rate_limited":
      return clientError(
        "rate_limited",
        "The AI service is busy. Please try again in a moment.",
        429,
      );
    case "credits_exhausted":
      return clientError(
        "credits_exhausted",
        "AI credits are exhausted. Please contact support.",
        402,
      );
    case "timeout":
      return clientError("timeout", "The AI request took too long. Please try again.", 504);
    case "auth":
      return clientError("ai_unavailable", "AI service is temporarily unavailable.", 503);
    case "malformed_response":
      return clientError("ai_failed", "AI returned an unreadable response. Please try again.", 502);
    case "upstream_5xx":
      return clientError("ai_unavailable", "AI service is temporarily unavailable.", 503);
    case "bad_request":
      return clientError("ai_failed", "AI couldn't process this request.", 422);
    default:
      return clientError("ai_failed", "AI request failed. Please try again.", 500);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return clientError("method_not_allowed", "Use POST.", 405);

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  // Authn: edge function has verify_jwt=true, so reaching here implies a
  // valid Supabase JWT. We also fetch the user for logging + authz hooks.
  const authHeader = req.headers.get("Authorization") ?? "";
  let userId: string | null = null;
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return clientError("unauthorized", "Sign in to use AI features.", 401);
    userId = data.user.id;
  } catch (err) {
    console.error(`[ai-handoff:${requestId}] auth check failed`, err);
    return clientError("unauthorized", "Sign in to use AI features.", 401);
  }

  // Authz: AI summarization is a Pro capability. The client UI hides this
  // for free users, but we re-verify here against RevenueCat so a tampered
  // client can't bypass the paywall. Failing closed on RC outage is
  // intentional — see `_shared/revenuecat.ts`.
  try {
    const check = await getEntitlementsForUser(userId!);
    if (!entitlementsGrant(check, "ai.summarize")) {
      console.log(`[ai-handoff:${requestId}] entitlement denied user=${userId}`);
      return clientError(
        "entitlement_required",
        "AI summaries are a Pro feature. Upgrade to continue.",
        402,
      );
    }
  } catch (err) {
    console.error(`[ai-handoff:${requestId}] entitlement check failed`, err);
    return clientError("ai_unavailable", "AI service is temporarily unavailable.", 503);
  }

  let body: RequestBody;
  try {
    const raw = await req.json();
    body = validate(raw);
  } catch (err) {
    if (err instanceof ValidationError) return clientError(err.code, err.message, 400);
    return clientError("invalid_body", "Could not parse request body.", 400);
  }

  let provider: AIProvider;
  try {
    provider = pickProvider();
  } catch (err) {
    console.error(`[ai-handoff:${requestId}] provider unavailable`, err);
    return clientError("ai_unavailable", "AI service is temporarily unavailable.", 503);
  }

  try {
    const messages = buildHandoffMessages(body.input);
    const result = await callWithRetry(provider, { messages, modelHint: body.modelHint });
    console.log(
      `[ai-handoff:${requestId}] ok user=${userId} provider=${result.providerName} model=${result.modelUsed} ms=${Date.now() - startedAt} chars=${result.content.length}`,
    );
    return json(200, {
      data: { summary: result.content },
      meta: { requestId },
    });
  } catch (err) {
    const ms = Date.now() - startedAt;
    if (err instanceof ProviderError) {
      console.error(
        `[ai-handoff:${requestId}] provider error user=${userId} code=${err.code} status=${err.status ?? ""} ms=${ms} msg=${err.message}`,
      );
      return mapProviderError(err);
    }
    console.error(`[ai-handoff:${requestId}] unexpected user=${userId} ms=${ms}`, err);
    return clientError("ai_failed", "AI request failed. Please try again.", 500);
  }
});
