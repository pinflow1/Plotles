import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE, getSessionUserId, verifyPassword } from "@/lib/auth";
import { getLiveblocksClient } from "@/lib/liveblocks";

export const dynamic = "force-dynamic";

function statusOf(err: unknown): number | null {
  const s = (err as { status?: unknown } | null)?.status;
  return typeof s === "number" ? s : null;
}

function signedOut(res: NextResponse): NextResponse {
  res.cookies.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

// What deleting the account would remove, so the screen can say it plainly
// before anyone confirms. (A story's owner is the Project's ownerId; there's
// no database link from a Project to its owner, so nothing is removed by
// deleting the user alone — the stories have to be deleted on purpose.)
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const [owned, contributedTo] = await Promise.all([
      prisma.project.findMany({
        where: { ownerId: userId },
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, _count: { select: { access: true } } },
      }),
      prisma.projectAccess.count({ where: { userId, project: { ownerId: { not: userId } } } }),
    ]);
    return NextResponse.json({
      ownedStories: owned.map((p) => ({ id: p.id, title: p.title, otherWriters: Math.max(0, p._count.access - 1) })),
      contributedTo,
    });
  } catch (err) {
    console.error("GET /api/account failed:", err);
    return NextResponse.json({ error: "Couldn't load that. Please try again." }, { status: 500 });
  }
}

// The text of a story lives in Liveblocks (one room per story), not in our
// database, so it has to be removed there too. Returns the stories whose text
// couldn't be removed; a room that's already gone counts as removed.
async function removeRooms(projectIds: string[]): Promise<string[]> {
  if (projectIds.length === 0) return [];
  let liveblocks;
  try {
    liveblocks = getLiveblocksClient();
  } catch (err) {
    console.error("Account deletion: no Liveblocks client:", err);
    return projectIds;
  }
  const results = await Promise.allSettled(projectIds.map((id) => liveblocks.deleteRoom(`project:${id}`)));
  return projectIds.filter((_, i) => {
    const r = results[i];
    return r.status === "rejected" && statusOf(r.reason) !== 404;
  });
}

// DELETE /api/account  { password }  -> deletes the account and everything it owns.
export async function DELETE(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password) return NextResponse.json({ error: "Enter your password to confirm." }, { status: 400 });

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { hashedPassword: true } });
    // Already deleted (say, a second tap): nothing left to do.
    if (!user) return signedOut(NextResponse.json({ ok: true, leftovers: 0 }));
    if (!(await verifyPassword(password, user.hashedPassword))) {
      return NextResponse.json({ error: "That password isn't right." }, { status: 403 });
    }

    const owned = await prisma.project.findMany({ where: { ownerId: userId }, select: { id: true } });
    const ownedIds = owned.map((p) => p.id);

    // Text first, then the database. Someone who asked for everything to go
    // doesn't get stopped by a hiccup at the editing service: if a few rooms
    // can't be removed they're logged so they can be cleaned up, and the
    // account is deleted regardless.
    const leftovers = await removeRooms(ownedIds);
    if (leftovers.length) console.error("Account deletion: Liveblocks rooms still to remove:", leftovers.map((id) => `project:${id}`));

    // One step, so it's all or nothing. Cascades take the rest: chapters,
    // access rows, writing logs, requests, ideas.
    await prisma.$transaction([prisma.project.deleteMany({ where: { ownerId: userId } }), prisma.user.delete({ where: { id: userId } })]);

    return signedOut(NextResponse.json({ ok: true, leftovers: leftovers.length }));
  } catch (err) {
    console.error("DELETE /api/account failed:", err);
    return NextResponse.json({ error: "We couldn't finish deleting your account just now. Please try again in a moment." }, { status: 500 });
  }
}
