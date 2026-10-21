import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { getProjectRole, isOwner } from "@/lib/access";

type Params = { params: { id: string; userId: string } };

// Owner only. `userId` is the person's real user id — the Collaborators list
// hands that to the owner alone, Anonymous Writers included.
async function findTarget(projectId: string, userId: string) {
  return prisma.projectAccess.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true, role: true },
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const role = await getProjectRole(sessionUserId, params.id);
  if (!isOwner(role)) return NextResponse.json({ error: "Only the owner can change access." }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (body?.role !== "edit" && body?.role !== "view") {
    return NextResponse.json({ error: "Role must be 'edit' or 'view'." }, { status: 400 });
  }

  const target = await findTarget(params.id, params.userId);
  if (!target) return NextResponse.json({ error: "That person isn't a collaborator on this story." }, { status: 404 });
  if (target.role === "owner") return NextResponse.json({ error: "The owner's access can't be changed." }, { status: 400 });

  const access = await prisma.projectAccess.update({ where: { id: target.id }, data: { role: body.role } });
  return NextResponse.json({ access });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const role = await getProjectRole(sessionUserId, params.id);
  if (!isOwner(role)) return NextResponse.json({ error: "Only the owner can remove access." }, { status: 403 });
  if (params.userId === sessionUserId) {
    return NextResponse.json({ error: "The owner can't remove themself." }, { status: 400 });
  }

  const target = await findTarget(params.id, params.userId);
  if (!target) return NextResponse.json({ error: "That person isn't a collaborator on this story." }, { status: 404 });
  if (target.role === "owner") return NextResponse.json({ error: "The owner can't be removed." }, { status: 400 });

  await prisma.projectAccess.delete({ where: { id: target.id } });
  return new NextResponse(null, { status: 204 });
}
