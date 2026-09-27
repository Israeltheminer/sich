import { NextRequest, NextResponse } from "next/server";
import { attachFeedback } from "@/lib/sitch/interactionStore";

/**
 * POST /api/sitch/feedback
 * Body: { interactionId: string, verdict: "good" | "bad", note?: string, preferredResponse?: string }
 *
 * This is the input side of the self-improvement loop: feedback attached here
 * is what the learning agent analyzes on the next /api/sitch/learn cycle.
 */
export async function POST(req: NextRequest) {
  let body: { interactionId?: string; verdict?: string; note?: string; preferredResponse?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { interactionId, verdict, note, preferredResponse } = body;

  if (!interactionId || typeof interactionId !== "string") {
    return NextResponse.json({ error: "`interactionId` (string) is required" }, { status: 400 });
  }
  if (verdict !== "good" && verdict !== "bad") {
    return NextResponse.json({ error: '`verdict` must be "good" or "bad"' }, { status: 400 });
  }

  const updated = await attachFeedback(interactionId, { verdict, note, preferredResponse });
  if (!updated) {
    return NextResponse.json({ error: `Unknown interactionId "${interactionId}"` }, { status: 404 });
  }

  return NextResponse.json({ interaction: updated });
}
