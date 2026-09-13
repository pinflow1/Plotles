import { BookOpen, Users } from "lucide-react";
import type { Chapter, Project } from "@prisma/client";
import { timeAgo } from "@/lib/format";
import { computePace } from "@/lib/pace";

type StoryCardProject = Project & { chapters: Chapter[]; collaboratorCount: number };

export function StoryCard({ project, onClick }: { project: StoryCardProject; onClick: () => void }) {
  const totalWords = project.chapters.reduce((sum, c) => sum + c.wordCount, 0);
  const pace = computePace(totalWords, project.goalWordCount, project.deadline);

  return (
    <button onClick={onClick} className="flex flex-col items-start rounded-xl text-left active:opacity-80">
      <div className="relative flex aspect-[3/4] w-full items-center justify-center rounded-lg bg-surface">
        <BookOpen size={26} strokeWidth={1.3} className="text-text-soft" />
        {project.collaboratorCount > 1 && (
          <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-paper/90">
            <Users size={11} strokeWidth={2} className="text-text-soft" />
          </div>
        )}
      </div>
      <div className="mt-1.5 w-full truncate text-[13px] text-text">{project.title}</div>
      <div className="truncate text-[11px] text-text-soft">{timeAgo(project.updatedAt)}</div>
      {pace && (
        <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-active">
          <div className="h-full rounded-full bg-strong" style={{ width: `${pace.progress * 100}%` }} />
        </div>
      )}
    </button>
  );
}
