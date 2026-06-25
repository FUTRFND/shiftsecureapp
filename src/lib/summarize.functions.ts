import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  transcript: z.string().min(10).max(20000),
  context: z.string().max(500).optional(),
});

export const summarizeHandoff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

    const system = `You are a clinical handoff assistant. Convert dictated free-form clinician notes into a clean, structured SBAR-style handoff. Be concise, factual, and never invent information. If a field is not mentioned, write "Not stated". Use plain text with section headers exactly:

PATIENT
SITUATION
BACKGROUND
ASSESSMENT
RECOMMENDATION
ACTION ITEMS (bulleted)`;

    const user = `${data.context ? `Context: ${data.context}\n\n` : ""}Dictated notes:\n"""${data.transcript}"""`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (res.status === 429) {
      throw new Error("Rate limit reached. Please wait a moment and try again.");
    }
    if (res.status === 402) {
      throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
    }
    if (!res.ok) {
      const t = await res.text();
      console.error("AI gateway error", res.status, t);
      throw new Error("AI summary failed. Please try again.");
    }

    const payload = await res.json();
    const summary: string = payload.choices?.[0]?.message?.content ?? "";
    return { summary };
  });
