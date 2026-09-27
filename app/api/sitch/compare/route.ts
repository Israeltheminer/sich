import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/sitch/profileStore";
import { addInteraction } from "@/lib/sitch/interactionStore";
import { generateResponse, generateBaselineResponse } from "@/lib/sitch/harness";

/**
 * POST /api/sitch/compare — playground-only. Runs the same message through a
 * generic baseline prompt AND through the Sitch-guided harness so the "before
 * Sitch / after Sitch" contrast can be shown side by side. Only the guided
 * response is logged as an interaction (that's the one feedback applies to).
 */
export async function POST(req: NextRequest) {
  let body: { message?: string; profileId?: string; context?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { message, context } = body;
  const profileId = body.profileId ?? "default";

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "`message` (string) is required" }, { status: 400 });
  }

  const profile = await getProfile(profileId);
  if (!profile) {
    return NextResponse.json({ error: `Unknown profileId "${profileId}"` }, { status: 404 });
  }

  const [baseline, guided] = await Promise.all([
    generateBaselineResponse(message, context),
    generateResponse(profile, message, context),
  ]);

  const interaction = await addInteraction({
    profileId: profile.id,
    profileVersionAtResponse: profile.version,
    message,
    context,
    response: guided.response,
    systemPromptUsed: guided.systemPromptUsed,
    llmModel: guided.llmModel,
    mocked: guided.mocked,
  });

  return NextResponse.json({
    interactionId: interaction.id,
    baseline: { response: baseline.response, mocked: baseline.mocked },
    guided: { response: guided.response, mocked: guided.mocked, usedFallback: guided.usedFallback },
    profile: {
      id: profile.id,
      name: profile.name,
      version: profile.version,
      traits: profile.traits,
      learnedPatterns: profile.learnedPatterns,
    },
  });
}
