import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { canEdit, getProjectRole } from "@/lib/access";
import { ANONYMOUS_MODES } from "@/lib/anonymous";
import { ExportView } from "@/components/projects/ExportView";

export default async function ExportPage({ params }: { params: { projectId: string } }) {
  const userId = await getSessionUserId();
  if (!userId) redirect(`/login?next=/projects/${params.projectId}/export`);

  const role = await getProjectRole(userId, params.projectId);
  if (!role) notFound();
  // Exporting hands over the whole manuscript, so it's for the owner and editors.
  if (!canEdit(role)) redirect(`/projects/${params.projectId}`);

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: { id: true, title: true, collaborationMode: true, chapters: { select: { wordCount: true } } },
  });
  if (!project) notFound();

  return (
    <ExportView
      project={{
        id: project.id,
        title: project.title,
        chapterCount: project.chapters.length,
        wordCount: project.chapters.reduce((sum, c) => sum + c.wordCount, 0),
        anonymous: ANONYMOUS_MODES.includes(project.collaborationMode),
      }}
    />
  );
}
