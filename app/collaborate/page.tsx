import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { CollaborateView } from "@/components/collaborate/CollaborateView";

export default async function CollaboratePage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?next=/collaborate");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { penName: true, avatarUrl: true } });
  if (!user) redirect("/login");

  return <CollaborateView user={user} />;
    }
