import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { getProjectRole } from "@/lib/access";
import { Room } from "@/components/editor/Room";
import { EditorView } from "@/components/editor/EditorView";

export default async function EditorPage({
  params,
  searchParams,
}: {
  params: { projectId: string };
  searchParams: { chapter?: string };
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect(`/login?next=/editor/${params.projectId}`);

  const role = await getProjectRole(userId, params.projectId);
  if (!role) notFound();

  let project, user;
  try {
    [project, user] = await Promise.all([
      prisma.project.findUnique({
        where: { id: params.projectId },
        include: { chapters: { orderBy: { orderIndex: "asc" } } },
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { penName: true, avatarUrl: true } }),
    ]);
  } catch (err) {
    console.error("EditorPage data fetch failed:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#111111] px-6 text-center text-[#D8D2C4]">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#8E8E8E]">Couldn&apos;t load this story</p>
        <p className="max-w-sm text-sm">{detail}</p>
      </main>
    );
  }

  if (!project || !user) notFound();
  if (project.chapters.length === 0) redirect("/dashboard");

  const requested = searchParams.chapter ? project.chapters.find((c) => c.id === searchParams.chapter) : undefined;
  const initialChapter = requested ?? [...project.chapters].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? project.chapters[0];

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
