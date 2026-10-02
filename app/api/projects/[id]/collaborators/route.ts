import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { getProjectRole, isOwner } from "@/lib/access";

const COLLABORATOR_SELECT = { role: true, user: { select: { id: true, penName: true, avatarUrl: true } } } as const;
const REQUEST_SELECT = {
  id: true,
  role: true,
  message: true,
  createdAt: true,
  recipient: { select: { id: true, penName: true, avatarUrl: true } },
} as const;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const role = await getProjectRole(userId, params.id);
  if (!role) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const [collaborators, pendingRequests] = await Promise.all([
    prisma.projectAccess.findMany({ where: { projectId: params.id }, select: COLLABORATOR_SELECT }),
    prisma.collaborationRequest.findMany({
      where: { projectId: params.id, status: "pending" },
      select: REQUEST_SELECT,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ collaborators, pendingRequests });
}

// Sends a request to a Plotless user found by pen name search (see
// /api/users/search) — no email. Creates a pending request, not instant
// access; the recipient has to accept it (see
// /api/collaboration-requests/[id]). Owner only.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const role = await getProjectRole(userId, params.id);
  if (!isOwner(role)) return NextResponse.json({ error: "Only the owner can invite collaborators." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const recipientId = typeof body?.userId === "string" ? body.userId : "";
  const inviteRole = body?.role === "edit" ? "edit" : "view";
  const message = typeof body?.message === "string" && body.message.trim() ? body.message.trim().slice(0, 280) : null;
  if (!recipientId) return NextResponse.json({ error: "Pick someone to invite." }, { status: 400 });
  if (recipientId === userId) return NextResponse.json({ error: "That's your own account." }, { status: 400 });

  const existingAccess = await prisma.projectAccess.findUnique({
    where: { projectId_userId: { projectId: params.id, userId: recipientId } },
  });
  if (existingAccess) {
    return NextResponse.json({ error: "This person already has access to the project." }, { status: 409 });
  }

  try {
    const request = await prisma.collaborationRequest.create({
      data: { projectId: params.id, initiatorId: userId, recipientId, role: inviteRole, message },
      select: REQUEST_SELECT,
    });
    return NextResponse.json({ request }, { status: 201 });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "There's already a pending invite out to this person." }, { status: 409 });
    }
    throw err;
  }
}
