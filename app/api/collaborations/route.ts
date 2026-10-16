import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { anonymousLabel } from "@/lib/anonymous";
import { participantCap } from "@/lib/collaboration-modes";

// Every story the signed-in user is part of that isn't solo — as the owner
// or as a participant — for Collaborate → My Collaborations. Only counts
// and the viewer's own label go out, never who the other participants are,
// so anonymous stories stay anonymous here too.
export async function GET(_req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const [rows, waiting] = await Promise.all([
    prisma.projectAccess.findMany({
      where: { userId, project: { collaborationMode: { not: "solo" } } },
      select: {
        role: true,
        isAnonymous: true,
        anonymousNumber: true,
        project: {
          select: {
            id: true,
            title: true,
            genres: true,
            collaborationMode: true,
            maxParticipants: true,
            ownerId: true,
            _count: { select: { access: true } },
          },
        },
      },
      orderBy: { project: { updatedAt: "desc" } },
    }),
    // Writers who have asked to join a story this user owns.
    prisma.collaborationRequest.findMany({
      where: { recipientId: userId, status: "pending", project: { ownerId: userId } },
      select: { projectId: true },
    }),
  ]);

  const waitingByProject = new Map<string, number>();
  for (const w of waiting) waitingByProject.set(w.projectId, (waitingByProject.get(w.projectId) ?? 0) + 1);

  const collaborations = rows.map((r) => ({
    id: r.project.id,
    title: r.project.title,
    genres: r.project.genres,
    mode: r.project.collaborationMode,
    isOwner: r.project.ownerId === userId,
    participantCount: r.project._count.access,
    capacity: participantCap(r.project.collaborationMode, r.project.maxParticipants),
    waiting: waitingByProject.get(r.project.id) ?? 0,
    // On an anonymous story, what the other writers call this user.
    youAre: r.isAnonymous && r.role !== "owner" ? anonymousLabel(r.anonymousNumber) : null,
  }));

  return NextResponse.json({ collaborations });
}
