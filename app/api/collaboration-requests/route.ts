import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { ANONYMOUS_MODES } from "@/lib/anonymous";

const PROJECT_SELECT = { id: true, title: true, ownerId: true, collaborationMode: true } as const;

// Every pending request the signed-in user is on either end of, for
// Collaborate → Requests. One request reads differently depending on who is
// looking and who owns the story:
//   waiting on you   — an invite someone sent you, or (as an owner) a
//                      writer asking to join your story
//   waiting on others — a join request you sent, or (as an owner) an invite
//                      you sent
export async function GET(_req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const [received, sent] = await Promise.all([
    prisma.collaborationRequest.findMany({
      where: { recipientId: userId, status: "pending" },
      select: {
        id: true,
        role: true,
        message: true,
        createdAt: true,
        project: { select: PROJECT_SELECT },
        initiator: { select: { id: true, penName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.collaborationRequest.findMany({
      where: { initiatorId: userId, status: "pending" },
      select: {
        id: true,
        role: true,
        message: true,
        createdAt: true,
        project: { select: PROJECT_SELECT },
        recipient: { select: { id: true, penName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const incoming = received.map((r) => ({
    id: r.id,
    // The recipient owns the story when a writer asked to join it;
    // otherwise the owner invited the recipient.
    kind: r.project.ownerId === userId ? "join_request" : "invite",
    role: r.role,
    message: r.message,
    createdAt: r.createdAt,
    anonymous: ANONYMOUS_MODES.includes(r.project.collaborationMode),
    project: { id: r.project.id, title: r.project.title },
    person: { id: r.initiator.id, penName: r.initiator.penName },
  }));

  const outgoing = sent.map((r) => {
    const iOwnIt = r.project.ownerId === userId;
    return {
      id: r.id,
      kind: iOwnIt ? "invite" : "join_request",
      role: r.role,
      message: r.message,
      createdAt: r.createdAt,
      anonymous: ANONYMOUS_MODES.includes(r.project.collaborationMode),
      project: { id: r.project.id, title: r.project.title },
      // An owner's own invites name the person they invited; a writer
      // asking to join doesn't need the owner's name.
      person: iOwnIt ? { id: r.recipient.id, penName: r.recipient.penName } : null,
    };
  });

  return NextResponse.json({ incoming, sent: outgoing });
                                         }
