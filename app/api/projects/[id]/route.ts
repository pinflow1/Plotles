import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { canEdit, getProjectRole, isOwner } from "@/lib/access";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const role = await getProjectRole(userId, params.id);
  if (!role) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { chapters: { orderBy: { orderIndex: "asc" } } },
  });
  if (!project) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({ project: { ...project, role } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const role = await getProjectRole(userId, params.id);
  if (!canEdit(role)) return NextResponse.json({ error: "You don't have edit access." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const data: Record<string, unknown> = {};
  if (typeof body?.title === "string" && body.title.trim()) data.title = body.title.trim();
  if (typeof body?.description === "string" || body?.description === null) data.description = body.description;
  if (typeof body?.coverUrl === "string" || body?.coverUrl === null) data.coverUrl = body.coverUrl;
  if (["planning", "drafting", "revising", "complete"].includes(body?.status)) data.status = body.status;
  if (body?.goalWordCount === null) data.goalWordCount = null;
  else if (typeof body?.goalWordCount === "number" && Number.isFinite(body.goalWordCount)) data.goalWordCount = Math.max(0, Math.round(body.goalWordCount));
  if (body?.deadline === null) data.deadline = null;
  else if (typeof body?.deadline === "string" && !isNaN(Date.parse(body.deadline))) data.deadline = new Date(body.deadline);

  try {
    const project = await prisma.project.update({ where: { id: params.id }, data });
    return NextResponse.json({ project });
  } catch (err) {
    console.error(`PATCH /api/projects/${params.id} failed:`, err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't save that: ${detail}` }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const role = await getProjectRole(userId, params.id);
  if (!isOwner(role)) return NextResponse.json({ error: "Only the owner can delete this project." }, { status: 403 });

  try {
    await prisma.project.delete({ where: { id: params.id } });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error(`DELETE /api/projects/${params.id} failed:`, err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't delete that: ${detail}` }, { status: 500 });
  }
}
