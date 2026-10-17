import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

type MatchResult = { kind: "matched"; projectId: string } | { kind: "none" } | { kind: "raced" };

// Anonymous Duo: pairs the signed-in writer with the story that has waited
// longest for a partner — an anonymous_duo story with only its owner in it,
// and not theirs. They join as Anonymous Writer 01; the owner sees them the
// same way and can tap to reveal who they are.
export async function POST(_req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const result = await prisma.$transaction(async (tx): Promise<MatchResult> => {
    // FOR UPDATE SKIP LOCKED: two writers matching at the same moment can't
    // both claim the same story — the second skips it and takes the next.
    const waiting = await tx.$queryRaw<{ id: string }[]>`
      SELECT p."id"
      FROM "Project" p
      WHERE p."collaborationMode" = 'anonymous_duo'
        AND p."ownerId" <> ${userId}
        AND (SELECT COUNT(*) FROM "ProjectAccess" a WHERE a."projectId" = p."id") = 1
        AND NOT EXISTS (SELECT 1 FROM "ProjectAccess" a WHERE a."projectId" = p."id" AND a."userId" = ${userId})
      ORDER BY p."createdAt" ASC
      LIMIT 1
      FOR UPDATE OF p SKIP LOCKED
    `;
    if (waiting.length === 0) return { kind: "none" };
    const projectId = waiting[0].id;

    // Re-check now that the story is locked: a match that committed a
    // moment ago isn't visible to the query above.
    const taken = await tx.projectAccess.count({ where: { projectId } });
    if (taken !== 1) return { kind: "raced" };

    await tx.projectAccess.create({
      data: { projectId, userId, role: "edit", isAnonymous: true, anonymousNumber: 1 },
    });
    return { kind: "matched", projectId };
  });

  if (result.kind === "none") {
    return NextResponse.json(
      { error: "No Anonymous Duo stories are waiting for a partner right now — check back soon." },
      { status: 404 }
    );
  }
  if (result.kind === "raced") {
    return NextResponse.json({ error: "Someone else was matched to that story first — tap Match me to try again." }, { status: 409 });
  }
  return NextResponse.json({ projectId: result.projectId });
}
