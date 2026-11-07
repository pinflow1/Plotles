"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronLeft, Plus } from "lucide-react";
import type { ProjectStatus } from "@prisma/client";
import { formatWordCount, timeAgo } from "@/lib/format";
import { computePace, type Pace } from "@/lib/pace";
import { NavDrawer } from "@/components/navigation/NavDrawer";

// Deliberately carries no owner id: on an Anonymous Duo the partner could use
// it to look the owner up, and this list never needs it.
export type ProjectListItem = {
  id: string;
  title: string;
  coverUrl: string | null;
  status: ProjectStatus;
  goalWordCount: number | null;
  deadline: Date | null;
  updatedAt: Date;
  role: "owner" | "edit" | "view";
  collaboratorCount: number;
  // Title of the chapter edited most recently, or null for a story with none yet.
  currentChapter: string | null;
  totalWords: number;
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning: "Planning",
  drafting: "Drafting",
  revising: "Revising",
  complete: "Complete",
};

// "32 of 50,000 words · 12 days left" — or just the word count when there's no goal.
function wordsLine(totalWords: number, pace: Pace | null): string {
  if (!pace) return formatWordCount(totalWords);
  const base = `${totalWords.toLocaleString()} of ${pace.goalWordCount.toLocaleString()} words`;
  if (pace.wordsRemaining === 0) return `${base} · goal reached`;
  if (pace.daysRemaining === null) return base;
  if (pace.overdue) return `${base} · past deadline`;
  if (pace.daysRemaining === 0) return `${base} · due today`;
  return `${base} · ${pace.daysRemaining} day${pace.daysRemaining === 1 ? "" : "s"} left`;
}

// Only for shared stories — kept on its own line so it never crowds out the rest.
function sharingLine(p: ProjectListItem): string {
  const parts: string[] = [];
  if (p.collaboratorCount > 1) parts.push(`${p.collaboratorCount} writers`);
  if (p.role === "edit") parts.push("Edit access");
  if (p.role === "view") parts.push("View access");
  return parts.join(" · ");
}

function ProjectRow({ project, onOpen }: { project: ProjectListItem; onOpen: () => void }) {
  const pace = computePace(project.totalWords, project.goalWordCount, project.deadline);
  const sharing = sharingLine(project);

  return (
    <button onClick={onOpen} className="flex w-full gap-3.5 rounded-2xl bg-surface p-3.5 text-left active:bg-active">
      <div className="flex h-[88px] w-[66px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-active">
        {project.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data URL, not something next/image's optimizer can handle
          <img src={project.coverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <BookOpen size={20} strokeWidth={1.3} className="text-text-soft" />
        )}
      </div>

      <div className="min-w-0 flex-1 self-center">
        <div className="truncate font-serif text-[17px] text-text">{project.title}</div>
        <div className="mt-0.5 truncate text-sm text-text-soft">{project.currentChapter ?? "No chapters yet"}</div>
        {pace && (
          <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-active">
            <div className="h-full rounded-full bg-strong" style={{ width: `${pace.progress * 100}%` }} />
          </div>
        )}
        <div className={`${pace ? "mt-1.5" : "mt-2"} truncate text-xs text-text`}>{wordsLine(project.totalWords, pace)}</div>
        <div className="mt-0.5 truncate text-xs text-text-soft">
          {STATUS_LABELS[project.status]} · edited {timeAgo(project.updatedAt)}
        </div>
        {sharing && <div className="truncate text-xs text-text-soft">{sharing}</div>}
      </div>
    </button>
  );
}

export function ProjectsView({
  projects,
  user,
}: {
  projects: ProjectListItem[];
  user: { penName: string; avatarUrl: string | null };
}) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // The router keeps a page it has just visited for a short while, so coming
  // back here right after creating or deleting a story could show the old
  // list. Asking for fresh data on arrival keeps the list honest.
  useEffect(() => {
    router.refresh();
  }, [router]);

  function newStory() {
    router.push("/projects/new");
  }

  return (
    <div className="min-h-screen bg-paper pb-16 pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between px-4 py-3">
        <button onClick={() => setDrawerOpen(true)} aria-label="Menu" className="rounded-lg p-2.5 text-text active:bg-active">
          <ChevronLeft size={20} strokeWidth={1.6} />
        </button>
        <span className="text-xs font-bold tracking-[0.16em] text-text">PROJECTS</span>
        <button onClick={newStory} aria-label="New story" className="rounded-lg p-2.5 text-text active:bg-active">
          <Plus size={19} strokeWidth={1.6} />
        </button>
      </header>

      <div className="mx-auto max-w-lg px-5 pt-2">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center px-6 pt-20 text-center">
            <BookOpen size={30} strokeWidth={1.2} className="text-text-soft" />
            <h1 className="mt-5 font-serif text-xl text-text">No projects yet</h1>
            <p className="mt-2 text-sm text-text-soft">Start a story and it will live here.</p>
            <button
              onClick={newStory}
              className="mt-6 w-full max-w-xs rounded-xl bg-strong py-3 text-sm font-semibold text-on-strong transition-opacity active:opacity-85"
            >
              Create your first story
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {projects.map((p) => (
              <ProjectRow key={p.id} project={p} onOpen={() => router.push(`/projects/${p.id}`)} />
            ))}
          </div>
        )}
      </div>

      <NavDrawer open={drawerOpen} onOpenChange={setDrawerOpen} user={user} active="projects" />
    </div>
  );
}
