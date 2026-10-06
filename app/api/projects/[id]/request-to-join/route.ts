import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

// The writer is the initiator here, the project owner is the recipient —
// the reverse direction of /api/projects/[id]/collaborators, which is
// for the owner targeting someone. Same CollaborationRequest model
// either way; accepting it is still the owner's call.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { ownerId: true, collaborationMode: true },
  });
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (project.collaborationMode !== "public" && project.collaborationMode !== "public_anonymous") {
    return NextResponse.json({ error: "This story isn't open for requests." }, { status: 400 });
  }
  if (project.ownerId === userId) {
    return NextResponse.json({ error: "You own this story." }, { status: 400 });
  }

  const existingAccess = await prisma.projectAccess.findUnique({
    where: { projectId_userId: { projectId: params.id, userId } },
  });
  if (existingAccess) return NextResponse.json({ error: "You already have access to this story." }, { status: 409 });

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" && body.message.trim() ? body.message.trim().slice(0, 280) : null;

  try {
    const request = await prisma.collaborationRequest.create({
      data: { projectId: params.id, initiatorId: userId, recipientId: project.ownerId, role: "edit", message },
    });
    return NextResponse.json({ request }, { status: 201 });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "You've already requested to join this story." }, { status: 409 });
    }
    throw err;
  }
}
