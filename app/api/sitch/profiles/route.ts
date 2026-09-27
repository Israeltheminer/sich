import { NextResponse } from "next/server";
import { getAllProfiles } from "@/lib/sitch/profileStore";

export async function GET() {
  const profiles = await getAllProfiles();
  return NextResponse.json({ profiles });
}
