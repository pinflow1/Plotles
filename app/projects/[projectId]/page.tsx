import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { getProjectRole } from "@/lib/access";
import { ProjectView } from "@/components/projects/ProjectView";

export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const userId = await getSessionUserId();
  if (!userId) redirect(`/login?next=/projects/${params.projectId}`);

  const role = await getProjectRole(userId, params.projectId);
  if (!role) notFound();

  const [project, user] = await Promise.all([
    prisma.project.findUnique({
      where: { id: params.projectId },
      include: { chapters: { orderBy: { orderIndex: "asc" } } },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { penName: true, avatarUrl: true } }),
  ]);
  if (!project || !user) notFound();

  return <ProjectView initialProject={{ ...project, role }} user={user} />;
}
