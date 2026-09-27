import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/sitch/profileStore";
import { getInteractionsForProfile } from "@/lib/sitch/interactionStore";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) {
    return NextResponse.json({ error: `Unknown profile "${id}"` }, { status: 404 });
  }
  const interactions = await getInteractionsForProfile(id);
  return NextResponse.json({ profile, interactions });
}
