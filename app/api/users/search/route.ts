import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

const MODES = ["solo", "duo", "anonymous_duo", "multiple", "public", "public_anonymous", "private", "private_anonymous"] as const;
type Mode = (typeof MODES)[number];

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const access = await prisma.projectAccess.findMany({
    where: { userId },
    select: {
      role: true,
      project: {
        include: { chapters: { orderBy: { orderIndex: "asc" } } },
      },
    },
    orderBy: { project: { updatedAt: "desc" } },
  });

  return NextResponse.json({
    projects: access.map((a) => ({ ...a.project, role: a.role })),
  });
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Give the story a title." }, { status: 400 });

  const collaborationMode: Mode = MODES.includes(body?.collaborationMode) ? body.collaborationMode : "solo";

  // Duo/Anonymous Duo are always exactly 2 (owner + one partner) and
  // aren't user-configurable. Solo has no collaborators at all. Every
  // other mode can optionally cap the total, including the owner.
  let maxParticipants: number | null = null;
  if (collaborationMode === "duo" || collaborationMode === "anonymous_duo") {
    maxParticipants = 2;
  } else if (collaborationMode !== "solo" && Number.isInteger(body?.maxParticipants)) {
    maxParticipants = Math.max(2, Math.min(50, body.maxParticipants));
  }

  // Specific people to invite immediately — required for duo/private,
  // meaningless (ignored) for the discovery-based and solo modes.
  const picks: string[] = Array.isArray(body?.participantUserIds)
    ? body.participantUserIds.filter((id: unknown) => typeof id === "string" && id !== userId)
    : [];

  if (collaborationMode === "duo" && picks.length !== 1) {
    return NextResponse.json({ error: "Duo needs exactly one person." }, { status: 400 });
  }
  if ((collaborationMode === "private" || collaborationMode === "private_anonymous") && picks.length === 0) {
    return NextResponse.json({ error: "Private collaboration needs at least one person to start with." }, { status: 400 });
  }
  if (maxParticipants && picks.length + 1 > maxParticipants) {
    return NextResponse.json({ error: "That's more people than the participant cap allows." }, { status: 400 });
  }

  try {
    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          title,
          description: typeof body?.description === "string" ? body.description : null,
          ownerId: userId,
          collaborationMode,
          maxParticipants,
          access: { create: { userId, role: "owner" } },
          chapters: { create: { title: "Chapter One", orderIndex: 0 } },
        },
        include: { chapters: true },
      });

      for (const recipientId of picks) {
        await tx.collaborationRequest.create({
          data: { projectId: created.id, initiatorId: userId, recipientId, role: "edit" },
        });
      }

      return created;
    });

    return NextResponse.json({ project: { ...project, role: "owner" as const } }, { status: 201 });
  } catch (err) {
    console.error("POST /api/projects failed:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't create the story: ${detail}` }, { status: 500 });
  }
}
