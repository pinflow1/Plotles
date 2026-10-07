import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

// Duo/anonymous_duo are fixed at two and not something you add a third
// person to; solo has no collaboration at all. Everything else can take
// more people, space permitting.
const INVITABLE_MODES = ["multiple", "public", "public_anonymous", "private", "private_anonymous"];

export async function GET(_req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const projects = await prisma.project.findMany({
    where: { ownerId: userId, collaborationMode: { in: INVITABLE_MODES } },
    select: {
      id: true,
      title: true,
      collaborationMode: true,
      maxParticipants: true,
      _count: { select: { access: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const invitable = projects
    .filter((p) => p.maxParticipants === null || p._count.access < p.maxParticipants)
    .map((p) => ({ id: p.id, title: p.title, collaborationMode: p.collaborationMode }));

  return NextResponse.json({ projects: invitable });
}
