import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/sitch/profileStore";
import { addInteraction } from "@/lib/sitch/interactionStore";
import { generateResponse } from "@/lib/sitch/harness";

/**
 * POST /api/sitch/respond
 *
 * The core Sitch developer API: an application sends a user message and gets
 * back a response already shaped by the audience's learned communication
 * profile, plus the interactionId needed to later submit feedback on it.
 *
 * Body: { message: string, profileId?: string, context?: string }
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

  const result = await generateResponse(profile, message, context);

  const interaction = await addInteraction({
    profileId: profile.id,
    profileVersionAtResponse: profile.version,
    message,
    context,
    response: result.response,
    systemPromptUsed: result.systemPromptUsed,
    llmModel: result.llmModel,
    mocked: result.mocked,
  });

  return NextResponse.json({
    interactionId: interaction.id,
    response: result.response,
    profile: {
      id: profile.id,
      name: profile.name,
      version: profile.version,
      traits: profile.traits,
      learnedPatterns: profile.learnedPatterns,
    },
    meta: {
      model: result.llmModel,
      mocked: result.mocked,
      usedFallback: result.usedFallback,
    },
  });
}
