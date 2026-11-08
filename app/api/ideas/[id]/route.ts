import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const idea = await prisma.idea.findUnique({ where: { id: params.id } });
  if (!idea || idea.userId !== userId) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await prisma.idea.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
