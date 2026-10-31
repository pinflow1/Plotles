import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { IdeasView } from "@/components/ideas/IdeasView";

export default async function IdeasPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?next=/ideas");

  const [ideas, user] = await Promise.all([
    prisma.idea.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.user.findUnique({ where: { id: userId }, select: { penName: true, avatarUrl: true } }),
  ]);
  if (!user) redirect("/login");

  return <IdeasView initialIdeas={ideas} user={user} />;
}
