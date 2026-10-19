import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { canEdit, getProjectRole } from "@/lib/access";
import { dayDiff, isValidDateKey } from "@/lib/streak-calc";

type Params = { params: { id: string; chapterId: string } };

// The writer's own calendar day, sent by their browser. The server's clock
// is UTC, which puts late-evening (or early-morning) writing in the wrong
// cell for anyone who isn't. Real time zones are never more than a day from
// UTC, so anything further off — or not a date at all — is ignored in favor
// of UTC today.
function loggedDay(localDate: unknown): Date {
  const utcToday = new Date().toISOString().slice(0, 10);
  if (isValidDateKey(localDate) && Math.abs(dayDiff(localDate, utcToday)) <= 1) return new Date(localDate);
  return new Date(utcToday);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const role = await getProjectRole(userId, params.id);
  if (!canEdit(role)) return NextResponse.json({ error: "You don't have edit access." }, { status: 403 });

  const body = await req.json().catch(() => null);

  if (body?.reorder === "up" || body?.reorder === "down") {
    const chapters = await prisma.chapter.findMany({
      where: { projectId: params.id },
      orderBy: { orderIndex: "asc" },
    });
    const index = chapters.findIndex((c) => c.id === params.chapterId);
    const swapWith = body.reorder === "up" ? index - 1 : index + 1;
    if (index === -1 || swapWith < 0 || swapWith >= chapters.length) {
      return NextResponse.json({ chapters });
    }
    const a = chapters[index];
    const b = chapters[swapWith];
    await prisma.$transaction([
      prisma.chapter.update({ where: { id: a.id }, data: { orderIndex: b.orderIndex } }),
      prisma.chapter.update({ where: { id: b.id }, data: { orderIndex: a.orderIndex } }),
    ]);
    const updated = await prisma.chapter.findMany({
      where: { projectId: params.id },
      orderBy: { orderIndex: "asc" },
    });
    return NextResponse.json({ chapters: updated });
  }

  const data: Record<string, unknown> = {};
  if (typeof body?.title === "string" && body.title.trim()) data.title = body.title.trim();

  let wordDelta = 0;
  if (typeof body?.wordCount === "number" && Number.isFinite(body.wordCount)) {
    const newCount = Math.max(0, Math.round(body.wordCount));
    const current = await prisma.chapter.findUnique({ where: { id: params.chapterId }, select: { wordCount: true } });
    wordDelta = newCount - (current?.wordCount ?? 0);
    data.wordCount = newCount;
  }

  try {
    const [chapter] = await prisma.$transaction([
      prisma.chapter.update({ where: { id: params.chapterId }, data }),
      prisma.project.update({ where: { id: params.id }, data: { updatedAt: new Date() } }),
    ]);

    if (wordDelta !== 0) {
      const day = loggedDay(body?.localDate);
      await prisma.writingLog.upsert({
        where: { userId_projectId_date: { userId, projectId: params.id, date: day } },
        create: { userId, projectId: params.id, date: day, words: wordDelta },
        update: { words: { increment: wordDelta } },
      });
    }

    return NextResponse.json({ chapter });
  } catch (err) {
    console.error(`PATCH /api/projects/${params.id}/chapters/${params.chapterId} failed:`, err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't save that: ${detail}` }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const role = await getProjectRole(userId, params.id);
  if (!canEdit(role)) return NextResponse.json({ error: "You don't have edit access." }, { status: 403 });

  const remaining = await prisma.chapter.count({ where: { projectId: params.id } });
  if (remaining <= 1) {
    return NextResponse.json({ error: "A story needs at least one chapter." }, { status: 400 });
  }

  await prisma.chapter.delete({ where: { id: params.chapterId } });
  return new NextResponse(null, { status: 204 });
}
