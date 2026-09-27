const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const PRIMARY_MODEL = process.env.GROQ_PRIMARY_MODEL ?? "openai/gpt-oss-120b";
const FALLBACK_MODEL = process.env.GROQ_FALLBACK_MODEL ?? "openai/gpt-oss-20b";
const REQUEST_TIMEOUT_MS = 20_000;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionResult {
  content: string;
  model: string;
  usedFallback: boolean;
  mocked: boolean;
}

export async function complete(
  messages: ChatMessage[],
  opts: { temperature?: number; json?: boolean } = {}
): Promise<CompletionResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return { content: mockResponse(messages), model: "mock", usedFallback: false, mocked: true };
  }

  try {
    return await callGroq(PRIMARY_MODEL, messages, apiKey, opts);
  } catch (primaryErr) {
    console.error("[sitch] primary model failed, retrying with fallback model:", primaryErr);
    try {
      const result = await callGroq(FALLBACK_MODEL, messages, apiKey, opts);
      return { ...result, usedFallback: true };
    } catch (fallbackErr) {
      console.error("[sitch] fallback model also failed, using mock response:", fallbackErr);
      return { content: mockResponse(messages), model: "mock", usedFallback: true, mocked: true };
    }
  }
}

async function callGroq(
  model: string,
  messages: ChatMessage[],
  apiKey: string,
  opts: { temperature?: number; json?: boolean }
): Promise<CompletionResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts.temperature ?? 0.6,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Groq API error ${res.status}: ${text}`);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    return { content, model, usedFallback: false, mocked: false };
  } finally {
    clearTimeout(timeout);
  }
}

// Keeps the playground and API demoable with zero setup / when Groq is
// unreachable (rate limit, network) — reliability fallback for live demo conditions.
function mockResponse(messages: ChatMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const preview = lastUser?.content?.slice(0, 60) ?? "";
  return `[Sitch mock mode — set GROQ_API_KEY to enable live responses] Acknowledged: "${preview}"`;
}
