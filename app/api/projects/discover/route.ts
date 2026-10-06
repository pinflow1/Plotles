import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

export async function GET(_req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const [projects, alreadyRequested] = await Promise.all([
    prisma.project.findMany({
      where: {
        collaborationMode: { in: ["public", "public_anonymous"] },
        access: { none: { userId } },
      },
      select: {
        id: true,
        title: true,
        description: true,
        genres: true,
        lookingFor: true,
        collaborationMode: true,
        maxParticipants: true,
        updatedAt: true,
        _count: { select: { access: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
    prisma.collaborationRequest.findMany({
      where: { initiatorId: userId, status: "pending" },
      select: { projectId: true },
    }),
  ]);

  const requestedIds = new Set(alreadyRequested.map((r) => r.projectId));

  const open = projects
    .filter((p) => p.maxParticipants === null || p._count.access < p.maxParticipants)
    .map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      genres: p.genres,
      lookingFor: p.lookingFor,
      collaborationMode: p.collaborationMode,
      participantCount: p._count.access,
      maxParticipants: p.maxParticipants,
      alreadyRequested: requestedIds.has(p.id),
    }));

  return NextResponse.json({ projects: open });
            }
