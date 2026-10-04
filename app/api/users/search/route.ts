import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

// Search by pen name only — no email lookups here, so this can't be used
// to check whether a given email address has an account.
export async function GET(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ users: [] });

  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      OR: [
        { penName: { contains: q, mode: "insensitive" } },
        { bio: { contains: q, mode: "insensitive" } },
        // Array membership is case-sensitive and exact-element only (no
        // partial-word match) — simple for now, can get smarter later.
        { genres: { has: q } },
        { interests: { has: q } },
      ],
    },
    select: { id: true, penName: true, avatarUrl: true, bio: true, genres: true, interests: true },
    take: 10,
    orderBy: { penName: "asc" },
  });

  return NextResponse.json({ users });
}
