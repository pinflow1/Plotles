import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

// The signed-in writer's own block list.
//
// A block hides the two writers from each other (Find Writers, profiles,
// each other's requests) and closes any request still pending between them.
// It never touches a story they already share — nobody is removed from a
// project they're part of because of a block.
//
// Only real writer ids are accepted, and the app only has one where the
// writer's name is already visible. An Anonymous Writer can be reported but
// not blocked: a block changes what the blocker sees, and that change would
// give away who the anonymous writer is.

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const rows = await prisma.block.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, blocked: { select: { id: true, penName: true, avatarUrl: true } } },
    });
    return NextResponse.json({
      blocks: rows.map((r) => ({
        userId: r.blocked.id,
        penName: r.blocked.penName,
        avatarUrl: r.blocked.avatarUrl,
        since: r.createdAt,
      })),
    });
  } catch (err) {
    console.error("GET /api/blocks failed", err);
    return NextResponse.json({ error: "Couldn't load your blocked writers." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const targetId = typeof body?.userId === "string" ? body.userId : "";
  if (!targetId) return NextResponse.json({ error: "Choose a writer to block." }, { status: 400 });
  if (targetId === userId) return NextResponse.json({ error: "You can't block yourself." }, { status: 400 });

  try {
    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, penName: true },
    });
    if (!target) return NextResponse.json({ error: "Writer not found." }, { status: 404 });

    await prisma.$transaction([
      prisma.block.upsert({
        where: { blockerId_blockedId: { blockerId: userId, blockedId: target.id } },
        create: { blockerId: userId, blockedId: target.id },
        update: {},
      }),
      // Anything still waiting between the two is closed, so it can't
      // resurface if the block is lifted later.
      prisma.collaborationRequest.updateMany({
        where: {
          status: "pending",
          OR: [
            { initiatorId: userId, recipientId: target.id },
            { initiatorId: target.id, recipientId: userId },
          ],
        },
        data: { status: "rejected", respondedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ ok: true, userId: target.id, penName: target.penName });
  } catch (err) {
    console.error("POST /api/blocks failed", err);
    return NextResponse.json({ error: "Couldn't block that writer. Please try again." }, { status: 500 });
  }
}

// DELETE /api/blocks?userId=<id> — lift a block.
export async function DELETE(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const targetId = req.nextUrl.searchParams.get("userId") ?? "";
  if (!targetId) return NextResponse.json({ error: "Choose a writer to unblock." }, { status: 400 });

  try {
    await prisma.block.deleteMany({ where: { blockerId: userId, blockedId: targetId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/blocks failed", err);
    return NextResponse.json({ error: "Couldn't unblock that writer. Please try again." }, { status: 500 });
  }
}
