import { complete } from "./llmClient";
import { getProfile, saveProfile } from "./profileStore";
import { getUnconsumedFeedbackInteractions, markConsumed } from "./interactionStore";
import { CommunicationProfile, CommunicationTraits, Interaction, LearningProposal, PatternCandidate } from "./types";

const ANALYST_SYSTEM_PROMPT = `You are Sitch's Communication Learning Agent. You study real interaction examples — a message, the response Sitch gave, and human feedback about whether the response's TONE/STYLE (not factual correctness) matched the audience — and turn that into reusable communication guidance.

Do the following, in order:
1. Identify concrete communication patterns suggested by the feedback: tone, formality, directness, vocabulary, sentence structure, cultural/contextual cues, things users reacted well or badly to.
2. For each pattern, state your confidence ("low" | "medium" | "high") and cite which example(s) support it.
3. Decide if the evidence is strong enough to justify changing the communication profile at all. A single ambiguous example, or feedback that's really about task correctness rather than tone, is NOT enough — set meaningfulChange to false in that case.
4. If meaningful, propose updated profile traits and an updated learnedPatterns list: short, reusable, imperative-style guidance strings (max 8 total). Merge with the existing list rather than duplicating — drop ones that are contradicted, keep ones still supported, add new ones.
5. Write one short paragraph, changeSummary, explaining what changed and why, for a human reviewer who will approve or reject this update.

Respond with ONLY strict JSON, no markdown fences, in exactly this shape:
{
  "patternsDetected": [{ "pattern": string, "confidence": "low"|"medium"|"high", "evidence": string }],
  "meaningfulChange": boolean,
  "proposedTraits": { "formality": string, "directness": string, "warmth": string, "vocabulary": string, "responseLength": string, "languageMixing": string },
  "proposedLearnedPatterns": string[],
  "changeSummary": string
}`;

interface AnalystOutput {
  patternsDetected: PatternCandidate[];
  meaningfulChange: boolean;
  proposedTraits: CommunicationTraits;
  proposedLearnedPatterns: string[];
  changeSummary: string;
}

export async function analyzeInteractions(profileId: string): Promise<LearningProposal> {
  const profile = await getProfile(profileId);
  if (!profile) throw new Error(`Unknown profile: ${profileId}`);

  const interactions = await getUnconsumedFeedbackInteractions(profileId);
  const reasoningTrace: string[] = [];
  reasoningTrace.push(`New interaction batch received: ${interactions.length} interaction(s) with feedback pending analysis.`);

  if (interactions.length === 0) {
    reasoningTrace.push("Nothing new since the last learning cycle — no pattern detection to run.");
    return emptyProposal(profile, reasoningTrace, "No new feedback since the last learning cycle.");
  }

  reasoningTrace.push("Communication pattern detection: sending interaction batch to the learning agent...");

  const examplesBlock = interactions.map(describeInteractionForAnalyst).join("\n\n---\n\n");
  const userPrompt = `Current profile traits: ${JSON.stringify(profile.traits)}\nCurrent learned patterns: ${JSON.stringify(profile.learnedPatterns)}\n\nNew interactions:\n\n${examplesBlock}`;

  let parsed: AnalystOutput | null = null;
  let usedFallbackHeuristic = false;

  try {
    const result = await complete(
      [
        { role: "system", content: ANALYST_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0.3, json: true }
    );
    parsed = parseAnalystJson(result.content);
    if (!parsed) throw new Error("Analyst response was not valid JSON");
    reasoningTrace.push(`Pattern evaluated: agent found ${parsed.patternsDetected.length} candidate pattern(s) via ${result.mocked ? "mock mode" : result.model}.`);
  } catch (err) {
    console.error("[sitch] learning agent LLM analysis failed, using heuristic fallback:", err);
    parsed = heuristicFallbackAnalysis(interactions, profile);
    usedFallbackHeuristic = true;
    reasoningTrace.push("LLM analysis unavailable — fell back to heuristic pattern detection so the loop still completes.");
  }

  reasoningTrace.push(
    parsed.meaningfulChange
      ? "Guidance updated: evidence judged sufficient — proposing a communication profile update."
      : "No update: evidence judged insufficient to change the communication profile."
  );

  return {
    profileId,
    baseVersion: profile.version,
    createdAt: new Date().toISOString(),
    reasoningTrace,
    patternsDetected: parsed.patternsDetected,
    proposedTraits: parsed.meaningfulChange ? parsed.proposedTraits : profile.traits,
    proposedLearnedPatterns: parsed.meaningfulChange ? dedupe(parsed.proposedLearnedPatterns) : profile.learnedPatterns,
    changeSummary: parsed.changeSummary,
    meaningfulChange: parsed.meaningfulChange,
    consumedInteractionIds: interactions.map((i) => i.id),
    usedFallbackHeuristic,
  };
}

export async function applyProposal(proposal: LearningProposal): Promise<CommunicationProfile> {
  const profile = await getProfile(proposal.profileId);
  if (!profile) throw new Error(`Unknown profile: ${proposal.profileId}`);
  if (profile.version !== proposal.baseVersion) {
    throw new Error("Profile has changed since this proposal was generated — re-run the learning cycle.");
  }

  const now = new Date().toISOString();
  const updated: CommunicationProfile = {
    ...profile,
    version: profile.version + 1,
    updatedAt: now,
    traits: proposal.proposedTraits,
    learnedPatterns: proposal.proposedLearnedPatterns,
    history: [
      ...profile.history,
      {
        version: profile.version,
        timestamp: now,
        traits: profile.traits,
        learnedPatterns: profile.learnedPatterns,
        changeSummary: proposal.changeSummary,
        consumedInteractionIds: proposal.consumedInteractionIds,
      },
    ],
  };

  await saveProfile(updated);
  await markConsumed(proposal.consumedInteractionIds);
  return updated;
}

function describeInteractionForAnalyst(i: Interaction): string {
  const lines = [`Message: ${i.message}`, `Response given: ${i.response}`];
  if (i.feedback) {
    lines.push(`Feedback: ${i.feedback.verdict}${i.feedback.note ? ` — ${i.feedback.note}` : ""}`);
    if (i.feedback.preferredResponse) {
      lines.push(`Preferred response instead: ${i.feedback.preferredResponse}`);
    }
  }
  return lines.join("\n");
}

function parseAnalystJson(raw: string): AnalystOutput | null {
  try {
    return JSON.parse(raw) as AnalystOutput;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as AnalystOutput;
    } catch {
      return null;
    }
  }
}

function emptyProposal(profile: CommunicationProfile, reasoningTrace: string[], changeSummary: string): LearningProposal {
  return {
    profileId: profile.id,
    baseVersion: profile.version,
    createdAt: new Date().toISOString(),
    reasoningTrace,
    patternsDetected: [],
    proposedTraits: profile.traits,
    proposedLearnedPatterns: profile.learnedPatterns,
    changeSummary,
    meaningfulChange: false,
    consumedInteractionIds: [],
    usedFallbackHeuristic: false,
  };
}

function dedupe(patterns: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of patterns) {
    const key = p.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(p.trim());
    }
  }
  return out.slice(0, 8);
}

const INFORMAL_MARKERS = ["abeg", "dey", "wan", "abi", "na ", "sha", "oga", "una", "wetin"];

// Simple, explainable heuristic used only when the LLM analyst is unreachable —
// keeps the self-improvement loop demoable end-to-end even offline/rate-limited.
function heuristicFallbackAnalysis(interactions: Interaction[], profile: CommunicationProfile): AnalystOutput {
  const withPreferred = interactions.filter((i) => i.feedback?.preferredResponse);
  const patterns: PatternCandidate[] = [];
  const newLearned = [...profile.learnedPatterns];
  const traits: CommunicationTraits = { ...profile.traits };

  if (withPreferred.length > 0) {
    const avgGiven = average(withPreferred.map((i) => i.response.length));
    const avgPreferred = average(withPreferred.map((i) => i.feedback!.preferredResponse!.length));
    if (avgPreferred < avgGiven * 0.7) {
      traits.responseLength = "Short";
      patterns.push({ pattern: "Prefer noticeably shorter responses", confidence: "medium", evidence: `${withPreferred.length} example(s) where the preferred response was much shorter than the one given` });
      pushUnique(newLearned, "Keep responses short and to the point.");
    }
    const informalHits = withPreferred.filter((i) =>
      INFORMAL_MARKERS.some((m) => i.feedback!.preferredResponse!.toLowerCase().includes(m))
    );
    if (informalHits.length > 0) {
      traits.formality = "Low";
      traits.languageMixing = "Context dependent";
      patterns.push({ pattern: "Local/informal expressions are preferred over corporate phrasing", confidence: "medium", evidence: `${informalHits.length} example(s) with informal local phrasing in the preferred response` });
      pushUnique(newLearned, "Use local, informal expressions when the user's own message is informal.");
      pushUnique(newLearned, "Avoid corporate or overly formal phrasing.");
    }
  }

  const badVerdicts = interactions.filter((i) => i.feedback?.verdict === "bad" && !i.feedback?.preferredResponse);
  if (badVerdicts.length > 0) {
    patterns.push({ pattern: "Some responses were marked as not matching audience tone, without a corrected example", confidence: "low", evidence: `${badVerdicts.length} example(s) marked bad with only a note` });
  }

  return {
    patternsDetected: patterns,
    meaningfulChange: patterns.some((p) => p.confidence !== "low"),
    proposedTraits: traits,
    proposedLearnedPatterns: dedupe(newLearned),
    changeSummary:
      patterns.length > 0
        ? `Heuristic fallback analysis (LLM unavailable): adjusted profile based on ${withPreferred.length} corrected example(s) and ${badVerdicts.length} negative-only example(s).`
        : "Heuristic fallback analysis found no strong enough signal to change the profile.",
  };
}

function pushUnique(arr: string[], value: string) {
  if (!arr.some((v) => v.toLowerCase() === value.toLowerCase())) arr.push(value);
}

function average(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
