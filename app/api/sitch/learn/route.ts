import { NextRequest, NextResponse } from "next/server";
import { analyzeInteractions } from "@/lib/sitch/learningAgent";

/**
 * POST /api/sitch/learn
 * Body: { profileId: string }
 *
 * Runs the learning agent over unconsumed feedback for a profile and returns
 * a *proposal* — nothing is persisted yet. A human approves it via
 * /api/sitch/learn/apply (the "high-level decision" checkpoint from the spec).
 */
export async function POST(req: NextRequest) {
  let body: { profileId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { profileId } = body;
  if (!profileId || typeof profileId !== "string") {
    return NextResponse.json({ error: "`profileId` (string) is required" }, { status: 400 });
  }

  try {
    const proposal = await analyzeInteractions(profileId);
    return NextResponse.json({ proposal });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Learning cycle failed" }, { status: 500 });
  }
}
