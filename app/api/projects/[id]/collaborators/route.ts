import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { getProjectRole, isOwner } from "@/lib/access";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const role = await getProjectRole(userId, params.id);
  if (!role) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const collaborators = await prisma.projectAccess.findMany({
    where: { projectId: params.id },
    select: { role: true, user: { select: { id: true, penName: true, email: true, avatarUrl: true } } },
  });

  return NextResponse.json({ collaborators });
}

// Invites an existing Plotless account by email — V1 has no outbound email
// sending, so the invitee must already have signed up. Owner only.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const role = await getProjectRole(userId, params.id);
  if (!isOwner(role)) return NextResponse.json({ error: "Only the owner can invite collaborators." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const inviteRole = body?.role === "edit" ? "edit" : "view";
  if (!email) return NextResponse.json({ error: "Enter an email." }, { status: 400 });

  const invitee = await prisma.user.findUnique({ where: { email } });
  if (!invitee) {
    return NextResponse.json({ error: "No Plotless account uses that email yet." }, { status: 404 });
  }

  const access = await prisma.projectAccess.upsert({
    where: { projectId_userId: { projectId: params.id, userId: invitee.id } },
    update: { role: inviteRole },
    create: { projectId: params.id, userId: invitee.id, role: inviteRole },
    select: { role: true, user: { select: { id: true, penName: true, email: true, avatarUrl: true } } },
  });

  return NextResponse.json({ collaborator: access }, { status: 201 });
}
