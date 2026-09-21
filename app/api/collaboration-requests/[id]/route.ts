import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

// Accept or reject a request addressed to you. Only the recipient can
// respond to their own invite — not the project owner, not anyone else.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const status = body?.status === "accepted" || body?.status === "rejected" ? body.status : null;
  if (!status) return NextResponse.json({ error: "status must be \"accepted\" or \"rejected\"." }, { status: 400 });

  const request = await prisma.collaborationRequest.findUnique({ where: { id: params.id } });
  if (!request) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (request.recipientId !== userId) {
    return NextResponse.json({ error: "This invite isn't addressed to you." }, { status: 403 });
  }
  if (request.status !== "pending") {
    return NextResponse.json({ error: "This invite has already been responded to." }, { status: 409 });
  }

  try {
    if (status === "accepted") {
      // Both writes succeed or neither does — an accepted request with no
      // resulting access (or vice versa) would be a real data-integrity
      // problem, not just a display glitch.
      await prisma.$transaction([
        prisma.collaborationRequest.update({ where: { id: params.id }, data: { status, respondedAt: new Date() } }),
        prisma.projectAccess.upsert({
          where: { projectId_userId: { projectId: request.projectId, userId } },
          update: { role: request.role },
          create: { projectId: request.projectId, userId, role: request.role },
        }),
      ]);
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

// Cancel an invite you sent, before the recipient has responded. Only the
// initiator (the owner who sent it) can do this.
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
