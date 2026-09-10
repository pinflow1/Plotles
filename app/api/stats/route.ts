import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { getStreakAndHeatmap } from "@/lib/streak";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const stats = await getStreakAndHeatmap(userId);
  return NextResponse.json(stats);
}
