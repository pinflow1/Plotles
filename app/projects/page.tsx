import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { ProjectsView, type ProjectListItem } from "@/components/projects/ProjectsView";

export default async function ProjectsPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login?next=/projects");

  const [access, user] = await Promise.all([
    // Everything this writer can open — their own stories and ones they've been
    // let into — newest activity first, same order as the Dashboard. Fields are
    // picked one by one so the owner's id never travels with the list.
    prisma.projectAccess.findMany({
      where: { userId },
      select: {
        role: true,
        project: {
          select: {
            id: true,
            title: true,
            coverUrl: true,
            status: true,
            goalWordCount: true,
            deadline: true,
            updatedAt: true,
            chapters: { select: { title: true, wordCount: true, updatedAt: true } },
            _count: { select: { access: true } },
          },
        },
      },
      orderBy: { project: { updatedAt: "desc" } },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { penName: true, avatarUrl: true } }),
  ]);
  if (!user) redirect("/login");

  const projects: ProjectListItem[] = access.map(({ role, project: p }) => {
    const current = [...p.chapters].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    return {
      id: p.id,
      title: p.title,
      coverUrl: p.coverUrl,
      status: p.status,
      goalWordCount: p.goalWordCount,
      deadline: p.deadline,
      updatedAt: p.updatedAt,
      role,
      collaboratorCount: p._count.access,
      currentChapter: current?.title ?? null,
      totalWords: p.chapters.reduce((sum, c) => sum + c.wordCount, 0),
    };
  });

  return <ProjectsView projects={projects} user={user} />;
}
