import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { getLiveblocksClient } from "@/lib/liveblocks";
import { ANONYMOUS_OWNER_LABEL, anonymousLabel } from "@/lib/anonymous";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const room = typeof body?.room === "string" ? body.room : "";
  // Rooms are namespaced project:<id>.
  const projectId = room.startsWith("project:") ? room.slice("project:".length) : "";
  if (!projectId) return NextResponse.json({ error: "Unrecognized room." }, { status: 400 });

  const access = await prisma.projectAccess.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true, role: true, isAnonymous: true, anonymousNumber: true, project: { select: { collaborationMode: true } } },
  });
  if (!access) return NextResponse.json({ error: "You don't have access to this project." }, { status: 403 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { penName: true, avatarUrl: true },
  });
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // The id and userInfo below are visible to every other writer in the room
  // (cursor labels, presence). On an anonymous story a writer joins under
  // an opaque id — the access row's, not their user id — and their
  // "Anonymous Writer NN" label, with no avatar. On an Anonymous Duo the
  // owner goes by "Anonymous Author" the same way.
  const isDuoOwner = access.role === "owner" && access.project.collaborationMode === "anonymous_duo";
  const anonymous = (access.isAnonymous && access.role !== "owner") || isDuoOwner;
  const anonymousName = isDuoOwner ? ANONYMOUS_OWNER_LABEL : anonymousLabel(access.anonymousNumber);

  try {
    const liveblocks = getLiveblocksClient();
    const session = liveblocks.prepareSession(anonymous ? access.id : userId, {
      userInfo: anonymous
        ? { name: anonymousName }
        : { name: user.penName, avatar: user.avatarUrl ?? undefined },
    });
    session.allow(room, access.role === "view" ? ["room:read"] : ["room:write"]);

    const { status, body: responseBody } = await session.authorize();
    return new NextResponse(responseBody, { status });
  } catch (err) {
    console.error("POST /api/liveblocks-auth failed:", err);
    return NextResponse.json({ error: "Couldn't authorize the collaboration session." }, { status: 502 });
  }
}
