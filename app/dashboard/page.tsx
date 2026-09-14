import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { getStreakAndHeatmap } from "@/lib/streak";
import { computePace } from "@/lib/pace";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?next=/dashboard");

  const [access, ideas, user, stats] = await Promise.all([
    prisma.projectAccess.findMany({
      where: { userId },
      select: { role: true, project: { include: { chapters: true, access: true } } },
      orderBy: { project: { updatedAt: "desc" } },
    }),
    prisma.idea.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.user.findUnique({ where: { id: userId }, select: { penName: true, avatarUrl: true } }),
    getStreakAndHeatmap(userId),
  ]);
  if (!user) redirect("/login");

  const projects = access.map((a) => ({
    ...a.project,
    role: a.role,
    collaboratorCount: a.project.access.length,
  }));

  const dailyGoalTotal = projects.reduce((sum, p) => {
    const totalWords = p.chapters.reduce((s, c) => s + c.wordCount, 0);
    const pace = computePace(totalWords, p.goalWordCount, p.deadline);
    return sum + (pace?.dailyTarget ?? 0);
  }, 0);

  return (
    <DashboardView
      projects={projects}
      initialIdeas={ideas}
      user={user}
      streak={stats.streak}
      heatmap={stats.heatmap}
      dailyGoalTotal={dailyGoalTotal}
    />
  );
}
