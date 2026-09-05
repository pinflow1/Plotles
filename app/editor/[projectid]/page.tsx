import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { getProjectRole } from "@/lib/access";
import { Room } from "@/components/editor/Room";
import { EditorView } from "@/components/editor/EditorView";

export default async function EditorPage({ params }: { params: { projectId: string } }) {
  const userId = await getSessionUserId();
  if (!userId) redirect(`/login?next=/editor/${params.projectId}`);

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
  if (project.chapters.length === 0) redirect("/dashboard");

  const initialChapter = [...project.chapters].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? project.chapters[0];

  return (
    <Room projectId={project.id}>
      <EditorView
        project={{ id: project.id, title: project.title, chapters: project.chapters, role }}
        initialChapterId={initialChapter.id}
        user={user}
      />
    </Room>
  );
}
