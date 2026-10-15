import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

// What a writer browsing Find Stories may read about an open story before
// joining: the listing details plus the excerpt the owner chose to share.
// The manuscript itself is never exposed from here — nothing is pulled
// from the chapters, only what the owner typed into previewText.
//
// A story that isn't open to join doesn't exist as far as outsiders are
// concerned (404, not 403), the same as /api/projects/[id].
const OPEN_MODES = ["public", "public_anonymous"];

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const [project, access, pending] = await Promise.all([
    prisma.project.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        description: true,
        genres: true,
        lookingFor: true,
        collaborationMode: true,
        maxParticipants: true,
        previewText: true,
        _count: { select: { access: true } },
      },
    }),
    prisma.projectAccess.findUnique({
      where: { projectId_userId: { projectId: params.id, userId } },
      select: { id: true },
    }),
    prisma.collaborationRequest.findFirst({
      where: { projectId: params.id, initiatorId: userId, status: "pending" },
      select: { id: true },
    }),
  ]);

  const isMember = !!access;
  if (!project || (!isMember && !OPEN_MODES.includes(project.collaborationMode))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const participantCount = project._count.access;
  const full = project.maxParticipants !== null && participantCount >= project.maxParticipants;

  return NextResponse.json({
    story: {
      id: project.id,
      title: project.title,
      description: project.description,
      genres: project.genres,
      lookingFor: project.lookingFor,
      anonymous: project.collaborationMode === "public_anonymous",
      participantCount,
      maxParticipants: project.maxParticipants,
      full,
      excerpt: project.previewText,
      isMember,
      alreadyRequested: !!pending,
    },
  });
}
