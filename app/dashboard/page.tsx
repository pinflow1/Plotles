import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { getStreakAndHeatmap } from "@/lib/streak";
import { computePace } from "@/lib/pace";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?next=/dashboard");

  const [access, user, stats, invitations, recentIdeas] = await Promise.all([
    prisma.projectAccess.findMany({
      where: { userId },
      select: { role: true, project: { include: { chapters: true, _count: { select: { access: true } } } } },
      orderBy: { project: { updatedAt: "desc" } },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { penName: true, avatarUrl: true } }),
    getStreakAndHeatmap(userId),
    prisma.collaborationRequest.findMany({
      where: { recipientId: userId, status: "pending" },
      select: {
        id: true,
        role: true,
        message: true,
        createdAt: true,
        project: { select: { id: true, title: true, ownerId: true } },
        initiator: { select: { id: true, penName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Just a glance at the latest few — the Ideas page holds the rest.
    prisma.idea.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 3 }),
  ]);
  if (!user) redirect("/login");

  const projects = access.map((a) => ({
    ...a.project,
    // The page never needs the owner's user id, and on an Anonymous Duo it
    // would let the partner look the owner up — only the owner gets it.
    ownerId: a.role === "owner" ? a.project.ownerId : "",
    role: a.role,
    collaboratorCount: a.project._count.access,
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
  // ProjectAccess (owner/edit/view), but nothing ever creates one with
  // owner — narrowed here rather than in the schema.
  //
  // Every request listed here is addressed to the signed-in user. When
  // that user owns the story, it's a writer asking to join it rather than
  // someone inviting them, and the card words it that way.
  const pendingInvitations = invitations.map(({ project, ...inv }) => ({
    ...inv,
    role: inv.role as "edit" | "view",
    project: { id: project.id, title: project.title },
    isJoinRequest: project.ownerId === userId,
  }));

  return (
    <DashboardView
      projects={projects}
      user={user}
      initialIdeas={recentIdeas}
      streak={stats.streak}
      heatmap={stats.heatmap}
      dailyGoalTotal={dailyGoalTotal}
      initialInvitations={pendingInvitations}
    />
  );
}
