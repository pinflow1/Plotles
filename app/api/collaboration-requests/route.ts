import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

// Pending invites addressed to the signed-in user, across every project —
// this is what powers the Dashboard's "Invitations" section.
export async function GET(_req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const requests = await prisma.collaborationRequest.findMany({
    where: { recipientId: userId, status: "pending" },
    select: {
      id: true,
      role: true,
      message: true,
      createdAt: true,
      project: { select: { id: true, title: true } },
      initiator: { select: { id: true, penName: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ requests });
}
