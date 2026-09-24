import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { canEdit, getProjectRole } from "@/lib/access";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const role = await getProjectRole(userId, params.id);
  // TEMPORARY: debug field on the 404 so the next occurrence shows why,
  // instead of a bare "Not found." Remove once this is confirmed fixed.
  if (!role) return NextResponse.json({ error: "Not found.", debug: { userId, projectId: params.id } }, { status: 404 });

  const chapters = await prisma.chapter.findMany({
    where: { projectId: params.id },
    orderBy: { orderIndex: "asc" },
  });
  return NextResponse.json({ chapters });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const role = await getProjectRole(userId, params.id);
  if (!canEdit(role)) {
    return NextResponse.json(
      { error: "You don't have edit access.", debug: { userId, projectId: params.id, role } },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : "Untitled Chapter";

  const last = await prisma.chapter.findFirst({
    where: { projectId: params.id },
    orderBy: { orderIndex: "desc" },
  });

  const chapter = await prisma.chapter.create({
    data: { projectId: params.id, title, orderIndex: (last?.orderIndex ?? -1) + 1 },
  });

  return NextResponse.json({ chapter }, { status: 201 });
}
