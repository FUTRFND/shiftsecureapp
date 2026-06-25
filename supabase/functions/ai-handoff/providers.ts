// Provider abstraction for AI handoff summarization.
//
// The edge function only talks to AIProvider. Swapping providers (Lovable AI,
// OpenAI direct, Anthropic, self-hosted, etc.) means adding a new module here
// and changing pickProvider() — no client, database, or workflow changes.

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ProviderRequest = {
  messages: ChatMessage[];
  /** Provider-agnostic hint. Each provider maps to its own catalog. */
  modelHint?: "default" | "fast" | "quality";
};

export type ProviderResponse = {
  content: string;
  /** Surfaced for logging only — never returned to the mobile client. */
  providerName: string;
  modelUsed: string;
};

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "rate_limited"
      | "credits_exhausted"
      | "upstream_5xx"
      | "bad_request"
      | "timeout"
      | "malformed_response"
      | "auth"
      | "unknown",
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
  }
}

export interface AIProvider {
  readonly name: string;
  complete(req: ProviderRequest, signal: AbortSignal): Promise<ProviderResponse>;
}

// ---- Lovable AI Gateway implementation ----

const LOVABLE_MODELS = {
  default: "google/gemini-3-flash-preview",
  fast: "google/gemini-3-flash-preview",
  quality: "google/gemini-3-pro-preview",
} as const;

class LovableAIProvider implements AIProvider {
  readonly name = "lovable";
  constructor(private readonly apiKey: string) {}

  async complete(req: ProviderRequest, signal: AbortSignal): Promise<ProviderResponse> {
    const model = LOVABLE_MODELS[req.modelHint ?? "default"];
    let res: Response;
    try {
      res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model, messages: req.messages }),
        signal,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        throw new ProviderError("Upstream timed out", "timeout", true);
      }
      throw new ProviderError("Network error reaching AI provider", "upstream_5xx", true);
    }

    if (res.status === 429) throw new ProviderError("Rate limited", "rate_limited", true, 429);
    if (res.status === 402)
      throw new ProviderError("Credits exhausted", "credits_exhausted", false, 402);
    if (res.status === 401 || res.status === 403)
      throw new ProviderError("Provider rejected credentials", "auth", false, res.status);
    if (res.status >= 500)
      throw new ProviderError(`Upstream ${res.status}`, "upstream_5xx", true, res.status);
    if (!res.ok) {
      const body = await safeText(res);
      console.error("[ai-handoff] provider 4xx", res.status, body);
      throw new ProviderError(`Bad request: ${res.status}`, "bad_request", false, res.status);
    }

    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      throw new ProviderError("Provider returned invalid JSON", "malformed_response", false);
    }
    const content =
      (payload as any)?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new ProviderError("Provider returned empty content", "malformed_response", false);
    }

    return { content, providerName: this.name, modelUsed: model };
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}

// ---- Selection ----

export function pickProvider(): AIProvider {
  // Provider precedence is server-side only. To swap providers, add another
  // implementation above and change this function.
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) return new LovableAIProvider(lovableKey);
  throw new ProviderError(
    "No AI provider configured. Set LOVABLE_API_KEY in edge function secrets.",
    "auth",
    false,
  );
}
