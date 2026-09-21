import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, penName: true, avatarUrl: true, bio: true, genres: true, interests: true, createdAt: true },
  });
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  return NextResponse.json({ user });
}

// Lightweight, writing-focused profile fields only — this is not account
// settings (email/password aren't editable here).
export async function PATCH(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const data: { bio?: string | null; genres?: string[]; interests?: string[] } = {};

  if ("bio" in (body ?? {})) {
    data.bio = typeof body.bio === "string" && body.bio.trim() ? body.bio.trim().slice(0, 280) : null;
  }
  if ("genres" in (body ?? {})) {
    data.genres = Array.isArray(body.genres) ? body.genres.filter((g: unknown) => typeof g === "string" && g.trim()).slice(0, 10) : [];
  }
  if ("interests" in (body ?? {})) {
    data.interests = Array.isArray(body.interests) ? body.interests.filter((i: unknown) => typeof i === "string" && i.trim()).slice(0, 10) : [];
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, penName: true, avatarUrl: true, bio: true, genres: true, interests: true, createdAt: true },
    });
    return NextResponse.json({ user });
  } catch (err) {
    console.error("PATCH /api/auth/me failed:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't save your profile: ${detail}` }, { status: 500 });
  }
    }
               
