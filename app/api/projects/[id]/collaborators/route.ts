import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { getProjectRole, isOwner } from "@/lib/access";

const COLLABORATOR_SELECT = { role: true, user: { select: { id: true, penName: true, email: true, avatarUrl: true } } } as const;
const REQUEST_SELECT = {
  id: true,
  role: true,
  message: true,
  createdAt: true,
  recipient: { select: { id: true, penName: true, email: true, avatarUrl: true } },
} as const;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const role = await getProjectRole(userId, params.id);
  if (!role) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const [collaborators, pendingRequests] = await Promise.all([
    prisma.projectAccess.findMany({ where: { projectId: params.id }, select: COLLABORATOR_SELECT }),
    // Invites sent for this project that haven't been answered yet. Only
    // the owner needs to see these (they're the only one who can cancel
    // one), but there's no harm returning them to any collaborator.
    prisma.collaborationRequest.findMany({
      where: { projectId: params.id, status: "pending" },
      select: REQUEST_SELECT,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ collaborators, pendingRequests });
}

// Sends a collaboration request to an existing Plotless account by email —
// V1 has no outbound email sending, so the recipient must already have
// signed up. Owner only for now. This creates a pending request rather
// than granting access directly: the recipient has to accept it before
// they're actually added (see /api/collaboration-requests/[id]).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const role = await getProjectRole(userId, params.id);
  if (!isOwner(role)) return NextResponse.json({ error: "Only the owner can invite collaborators." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const inviteRole = body?.role === "edit" ? "edit" : "view";
  const message = typeof body?.message === "string" && body.message.trim() ? body.message.trim().slice(0, 280) : null;
  if (!email) return NextResponse.json({ error: "Enter an email." }, { status: 400 });

  const recipient = await prisma.user.findUnique({ where: { email } });
  if (!recipient) {
    return NextResponse.json({ error: "No Plotless account uses that email yet." }, { status: 404 });
  }
  if (recipient.id === userId) {
    return NextResponse.json({ error: "That's your own account." }, { status: 400 });
  }

  const existingAccess = await prisma.projectAccess.findUnique({
    where: { projectId_userId: { projectId: params.id, userId: recipient.id } },
  });
  if (existingAccess) {
    return NextResponse.json({ error: "This person already has access to the project." }, { status: 409 });
  }

  try {
    const request = await prisma.collaborationRequest.create({
      data: { projectId: params.id, initiatorId: userId, recipientId: recipient.id, role: inviteRole, message },
      select: REQUEST_SELECT,
    });
    return NextResponse.json({ request }, { status: 201 });
  } catch (err) {
    // Unique constraint on [projectId, recipientId, status] — a pending
    // invite to this person is already out for this project.
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return NextResponse.json({ error: "There's already a pending invite out to this person." }, { status: 409 });
    }
    throw err;
  }
}
