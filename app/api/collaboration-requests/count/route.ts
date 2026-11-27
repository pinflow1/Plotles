import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { blockedWith } from "@/lib/blocks";

// How many pending requests are waiting on the signed-in user to respond —
// invites sent to them, plus writers asking to join their stories. Just a
// number, for the badges in the menu and on Collaborate → Requests.
export async function GET(_req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const hidden = await blockedWith(userId);
  const waiting = await prisma.collaborationRequest.count({
    where: { recipientId: userId, status: "pending", initiatorId: { notIn: hidden } },
  });
  return NextResponse.json({ waiting });
}
