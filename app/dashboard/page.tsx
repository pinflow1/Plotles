import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { getStreakAndHeatmap } from "@/lib/streak";
import { computePace } from "@/lib/pace";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?next=/dashboard");

  const [access, ideas, user, stats, invitations] = await Promise.all([
    prisma.projectAccess.findMany({
      where: { userId },
      select: { role: true, project: { include: { chapters: true, access: true } } },
      orderBy: { project: { updatedAt: "desc" } },
    }),
    prisma.idea.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.user.findUnique({ where: { id: userId }, select: { penName: true, avatarUrl: true } }),
    getStreakAndHeatmap(userId),
    prisma.collaborationRequest.findMany({
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
    }),
  ]);
  if (!user) redirect("/login");

  const projects = access.map((a) => ({
    ...a.project,
    role: a.role,
    collaboratorCount: a.project.access.length,
  }));

  // Sum of today's pace across every project that actually has a goal +
  // deadline set — this is the benchmark the heatmap colors full squares
  // against. Recomputed from current goals each time, same as the pace
  // numbers shown elsewhere, rather than tracking a separate historical
  // target per day.
  const dailyGoalTotal = projects.reduce((sum, p) => {
    const totalWords = p.chapters.reduce((s, c) => s + c.wordCount, 0);
    const pace = computePace(totalWords, p.goalWordCount, p.deadline);
    return sum + (pace?.dailyTarget ?? 0);
  }, 0);

  // CollaborationRequest.role reuses the same CollaboratorRole enum as
  // ProjectAccess (owner/edit/view), but POST /api/projects/[id]/collaborators
  // only ever creates one with edit or view — owner isn't a real
  // possibility here, just not split into its own narrower schema enum yet.
  const pendingInvitations = invitations.map((inv) => ({ ...inv, role: inv.role as "edit" | "view" }));

  return (
    <DashboardView
      projects={projects}
      initialIdeas={ideas}
      user={user}
      streak={stats.streak}
      heatmap={stats.heatmap}
      dailyGoalTotal={dailyGoalTotal}
      initialInvitations={pendingInvitations}
    />
  );
}
