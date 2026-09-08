import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const access = await prisma.projectAccess.findMany({
    where: { userId },
    select: {
      role: true,
      project: {
        include: { chapters: { orderBy: { orderIndex: "asc" } } },
      },
    },
    orderBy: { project: { updatedAt: "desc" } },
  });

  return NextResponse.json({
    projects: access.map((a) => ({ ...a.project, role: a.role })),
  });
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Give the story a title." }, { status: 400 });

  try {
    const project = await prisma.project.create({
      data: {
        title,
        description: typeof body?.description === "string" ? body.description : null,
        ownerId: userId,
        access: { create: { userId, role: "owner" } },
        chapters: { create: { title: "Chapter One", orderIndex: 0 } },
      },
      include: { chapters: true },
    });

    return NextResponse.json({ project: { ...project, role: "owner" as const } }, { status: 201 });
  } catch (err) {
    console.error("POST /api/projects failed:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't create the story: ${detail}` }, { status: 500 });
  }
}
