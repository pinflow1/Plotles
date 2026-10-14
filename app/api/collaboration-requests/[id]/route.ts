import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

const ANONYMOUS_MODES = ["anonymous_duo", "public_anonymous", "private_anonymous"];
// Duo modes are always exactly two writers; every other mode uses the
// project's own maxParticipants (null = uncapped). Both count the owner.
const PAIR_MODES = ["duo", "anonymous_duo"];

type JoinResult = { full: true; capacity: number } | { full: false };

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
    include: { project: { select: { ownerId: true, collaborationMode: true, maxParticipants: true } } },
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
      const { ownerId, collaborationMode, maxParticipants } = request.project;

      // The person being added is whoever on this request ISN'T the owner:
      // the recipient when the owner invited them, the initiator when they
      // asked to join. (The signed-in user is always the recipient — on a
      // join request that's the owner, who already has access. Granting
      // access to the signed-in user would overwrite the owner's own row
      // instead of adding the writer.)
      const participantId = request.initiatorId === ownerId ? request.recipientId : request.initiatorId;
      const isAnonymous = ANONYMOUS_MODES.includes(collaborationMode);
      const capacity = PAIR_MODES.includes(collaborationMode) ? 2 : maxParticipants;

      const result = await prisma.$transaction(async (tx): Promise<JoinResult> => {
        const existing = await tx.projectAccess.findUnique({
          where: { projectId_userId: { projectId: request.projectId, userId: participantId } },
        });

        if (existing) {
          // Already in (e.g. invited and asked to join at the same time):
          // just apply the role. Keep their identity and Anonymous Writer
          // number as they are, and never touch the owner's row.
          if (existing.role !== "owner") {
            await tx.projectAccess.update({ where: { id: existing.id }, data: { role: request.role } });
          }
        } else {
          if (capacity !== null) {
            const taken = await tx.projectAccess.count({ where: { projectId: request.projectId } });
            if (taken >= capacity) return { full: true, capacity };
          }

          let anonymousNumber: number | null = null;
          if (isAnonymous) {
            const highest = await tx.projectAccess.aggregate({
              where: { projectId: request.projectId, isAnonymous: true },
              _max: { anonymousNumber: true },
            });
            anonymousNumber = (highest._max.anonymousNumber ?? 0) + 1;
          }

          await tx.projectAccess.create({
            data: { projectId: request.projectId, userId: participantId, role: request.role, isAnonymous, anonymousNumber },
          });
        }

        await tx.collaborationRequest.update({ where: { id: params.id }, data: { status, respondedAt: new Date() } });
        return { full: false };
      });

      // The request stays pending when the story is full, so the owner can
      // still decline it (or accept it after making room).
      if (result.full) {
        return NextResponse.json(
          { error: `This story is full — all ${result.capacity} writer spots are taken.` },
          { status: 409 }
        );
      }
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
