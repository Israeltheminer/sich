import { NextRequest, NextResponse } from "next/server";
import { applyProposal } from "@/lib/sitch/learningAgent";
import { LearningProposal } from "@/lib/sitch/types";

/**
 * POST /api/sitch/learn/apply
 * Body: { proposal: LearningProposal }
 *
 * Persists a previously-generated learning proposal: bumps the profile
 * version, snapshots the old traits/patterns into history, and marks the
 * consumed interactions as processed.
 */
export async function POST(req: NextRequest) {
  let body: { proposal?: LearningProposal };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.proposal) {
    return NextResponse.json({ error: "`proposal` is required" }, { status: 400 });
  }

  try {
    const updated = await applyProposal(body.proposal);
    return NextResponse.json({ profile: updated });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to apply proposal" }, { status: 409 });
  }
}
