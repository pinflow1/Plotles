import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?next=/dashboard");

  const [access, ideas, user] = await Promise.all([
    prisma.projectAccess.findMany({
      where: { userId },
      select: { role: true, project: { include: { chapters: true } } },
      orderBy: { project: { updatedAt: "desc" } },
    }),
    prisma.idea.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.user.findUnique({ where: { id: userId }, select: { penName: true, avatarUrl: true } }),
  ]);
  if (!user) redirect("/login");

  const projects = access.map((a) => ({ ...a.project, role: a.role }));

  return <DashboardView initialProjects={projects} initialIdeas={ideas} user={user} />;
}
