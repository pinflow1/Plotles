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

  // The page never needs the owner's user id, and on an Anonymous Duo it
  // would let the partner look the owner up — only the owner gets it.
  const ownerId = role === "owner" ? project.ownerId : "";

  return <ProjectView initialProject={{ ...project, ownerId, role }} user={user} />;
}
