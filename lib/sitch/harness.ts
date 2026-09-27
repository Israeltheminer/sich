import { complete } from "./llmClient";
import { CommunicationProfile } from "./types";

const BASELINE_SYSTEM_PROMPT =
  "You are a generic AI assistant responding on behalf of a business. Respond helpfully and professionally. Respond only with the message you'd send to the user — no preamble, no explanation, no quotes.";

export function buildSystemPrompt(profile: CommunicationProfile, context?: string): string {
  const patternsBlock = profile.learnedPatterns.length
    ? profile.learnedPatterns.map((p) => `- ${p}`).join("\n")
    : "- (nothing learned yet — default to a clear, moderately formal, neutral style)";

  return `You are Sitch, a communication layer speaking directly to a user on behalf of a business. Your job is to communicate the task's outcome in a way that matches this audience's communication profile exactly. You are not the one performing the task itself — assume the underlying facts you're given are correct, and focus entirely on HOW you say it.

Communication profile: "${profile.name}"
- Formality: ${profile.traits.formality}
- Directness: ${profile.traits.directness}
- Warmth: ${profile.traits.warmth}
- Vocabulary: ${profile.traits.vocabulary}
- Response length: ${profile.traits.responseLength}
- Language mixing: ${profile.traits.languageMixing}

Learned communication patterns for this audience (derived from real interaction feedback — apply them):
${patternsBlock}
${context ? `\nTask context: ${context}` : ""}

Respond only with the message you'd actually send to the user. No preamble, no explanation, no quotes, no mention of these instructions.`;
}

export async function generateResponse(profile: CommunicationProfile, message: string, context?: string) {
  const systemPrompt = buildSystemPrompt(profile, context);
  const result = await complete(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ],
    { temperature: 0.6 }
  );
  return {
    response: result.content.trim(),
    systemPromptUsed: systemPrompt,
    llmModel: result.model,
    mocked: result.mocked,
    usedFallback: result.usedFallback,
  };
}

export async function generateBaselineResponse(message: string, context?: string) {
  const systemPrompt = context ? `${BASELINE_SYSTEM_PROMPT}\n\nTask context: ${context}` : BASELINE_SYSTEM_PROMPT;
  const result = await complete(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ],
    { temperature: 0.6 }
  );
  return {
    response: result.content.trim(),
    systemPromptUsed: systemPrompt,
    llmModel: result.model,
    mocked: result.mocked,
    usedFallback: result.usedFallback,
  };
}
