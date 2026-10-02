import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

const ANONYMOUS_MODES = ["anonymous_duo", "public_anonymous", "private_anonymous"];

// Accept or reject a request addressed to you. Only the recipient can
// respond to their own invite.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const status = body?.status === "accepted" || body?.status === "rejected" ? body.status : null;
  if (!status) return NextResponse.json({ error: "status must be \"accepted\" or \"rejected\"." }, { status: 400 });

  const request = await prisma.collaborationRequest.findUnique({
    where: { id: params.id },
    include: { project: { select: { collaborationMode: true } } },
  });
  if (!request) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (request.recipientId !== userId) {
    return NextResponse.json({ error: "This invite isn't addressed to you." }, { status: 403 });
  }
  if (request.status !== "pending") {
    return NextResponse.json({ error: "This invite has already been responded to." }, { status: 409 });
  }

  try {
    if (status === "accepted") {
      const isAnonymous = ANONYMOUS_MODES.includes(request.project.collaborationMode);

      await prisma.$transaction(async (tx) => {
        await tx.collaborationRequest.update({ where: { id: params.id }, data: { status, respondedAt: new Date() } });

        let anonymousNumber: number | null = null;
        if (isAnonymous) {
          const highest = await tx.projectAccess.aggregate({
            where: { projectId: request.projectId, isAnonymous: true },
            _max: { anonymousNumber: true },
          });
          anonymousNumber = (highest._max.anonymousNumber ?? 0) + 1;
        }

        await tx.projectAccess.upsert({
          where: { projectId_userId: { projectId: request.projectId, userId } },
          update: { role: request.role, isAnonymous, anonymousNumber },
          create: { projectId: request.projectId, userId, role: request.role, isAnonymous, anonymousNumber },
        });
      });
    } else {
      await prisma.collaborationRequest.update({ where: { id: params.id }, data: { status, respondedAt: new Date() } });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`PATCH /api/collaboration-requests/${params.id} failed:`, err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't respond to that invite: ${detail}` }, { status: 500 });
  }
}

// Cancel an invite you sent, before the recipient has responded.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const request = await prisma.collaborationRequest.findUnique({ where: { id: params.id } });
  if (!request) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (request.initiatorId !== userId) {
    return NextResponse.json({ error: "You didn't send this invite." }, { status: 403 });
  }
  if (request.status !== "pending") {
    return NextResponse.json({ error: "This invite has already been responded to." }, { status: 409 });
  }

  await prisma.collaborationRequest.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
