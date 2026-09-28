import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { getProjectRole } from "@/lib/access";
import { authorizeLiveblocksUser } from "@/lib/liveblocks";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const room = typeof body?.room === "string" ? body.room : "";
  // Rooms are namespaced project:<id>.
  const projectId = room.startsWith("project:") ? room.slice("project:".length) : "";
  if (!projectId) return NextResponse.json({ error: "Unrecognized room." }, { status: 400 });

  const role = await getProjectRole(userId, projectId);
  if (!role) return NextResponse.json({ error: "You don't have access to this project." }, { status: 403 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { penName: true, avatarUrl: true },
  });
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const { token } = await authorizeLiveblocksUser({
      userId,
      userInfo: { name: user.penName, avatar: user.avatarUrl },
      room,
      permission: role === "view" ? "room:read" : "room:write",
    });
    return NextResponse.json({ token });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Couldn't authorize the collaboration session." }, { status: 502 });
  }
}
