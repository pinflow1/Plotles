"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronLeft, Plus } from "lucide-react";
import type { Chapter, Idea, Project } from "@prisma/client";
import { api } from "@/lib/api-client";
import { timeAgo, formatWordCount } from "@/lib/format";
import { NavDrawer } from "@/components/navigation/NavDrawer";

type ProjectWithChapters = Project & { chapters: Chapter[]; role: "owner" | "edit" | "view" };

export function DashboardView({
  initialProjects,
  initialIdeas,
  user,
}: {
  initialProjects: ProjectWithChapters[];
  initialIdeas: Idea[];
  user: { penName: string; avatarUrl: string | null };
}) {
  const router = useRouter();
  const [projects, setProjects] = useState(initialProjects);
  const [ideas, setIdeas] = useState(initialIdeas);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newIdea, setNewIdea] = useState("");
  const [creating, setCreating] = useState(false);

  const mostRecent = projects[0];
  const mostRecentChapter = mostRecent && [...mostRecent.chapters].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];

  async function newStory() {
    setCreating(true);
    try {
      const { project } = await api.post<{ project: ProjectWithChapters }>("/api/projects", { title: "Untitled Story" });
      router.push(`/editor/${project.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function addIdea(e: React.FormEvent) {
    e.preventDefault();
    if (!newIdea.trim()) return;
    const { idea } = await api.post<{ idea: Idea }>("/api/ideas", { body: newIdea.trim() });
    setIdeas((prev) => [idea, ...prev]);
    setNewIdea("");
  }

  async function removeIdea(id: string) {
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    await api.delete(`/api/ideas/${id}`);
  }

  return (
    <div className="min-h-screen bg-paper pb-16 pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between px-4 py-3">
        <button onClick={() => setDrawerOpen(true)} aria-label="Menu" className="rounded-lg p-2.5 text-text active:bg-active">
          <ChevronLeft size={20} strokeWidth={1.6} />
        </button>
        <span className="text-xs font-bold tracking-[0.16em] text-text">PLOTLESS</span>
        <div className="w-9" />
      </header>

      <div className="mx-auto max-w-lg px-5">
        {mostRecent && mostRecentChapter && (
          <section className="mt-2 rounded-2xl bg-surface p-5">
            <div className="text-xs uppercase tracking-[0.08em] text-text-soft">Continue Writing</div>
            <div className="mt-2 font-serif text-xl text-text">{mostRecent.title}</div>
            <div className="mt-0.5 text-sm text-text-soft">
              {mostRecentChapter.title} · {formatWordCount(mostRecentChapter.wordCount)}
            </div>
            <button
              onClick={() => router.push(`/editor/${mostRecent.id}`)}
              className="mt-4 w-full rounded-xl bg-strong py-3 text-sm font-semibold text-on-strong transition-opacity active:opacity-85"
            >
              Continue writing
            </button>
          </section>
        )}

        <div className="mb-3 mt-8 flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.08em] text-text-soft">Your Projects</span>
          <button onClick={newStory} disabled={creating} className="flex items-center gap-1 text-sm text-text disabled:opacity-50">
            <Plus size={14} strokeWidth={2} />
            New Story
          </button>
        </div>

        <div className="space-y-1">
          {projects.map((p) => {
            const chapter = [...p.chapters].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
            return (
              <button
                key={p.id}
                onClick={() => router.push(`/editor/${p.id}`)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left active:bg-active"
              >
                <div className="flex h-[50px] w-[38px] shrink-0 items-center justify-center rounded-md bg-surface">
                  <BookOpen size={16} strokeWidth={1.5} className="text-text-soft" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] text-text">{p.title}</div>
                  <div className="truncate text-xs text-text-soft">{chapter?.title ?? "No chapters yet"}</div>
                </div>
                <div className="shrink-0 text-xs text-text-soft">{timeAgo(p.updatedAt)}</div>
              </button>
            );
          })}
          {projects.length === 0 && <p className="px-2 py-4 text-sm text-text-soft">No stories yet — start your first one above.</p>}
        </div>

        <div className="mb-3 mt-8 text-xs uppercase tracking-[0.08em] text-text-soft">Ideas</div>
        <form onSubmit={addIdea} className="mb-2">
          <input
            value={newIdea}
            onChange={(e) => setNewIdea(e.target.value)}
            placeholder="Jot something down…"
            className="w-full rounded-xl border border-divider bg-transparent px-3 py-2 text-sm text-text-soft outline-none focus-visible:border-text"
          />
        </form>
        <div className="space-y-1">
          {ideas.map((idea) => (
            <div key={idea.id} className="group flex items-start justify-between gap-2 rounded-xl px-2 py-2">
              <p className="text-sm text-text-soft">{idea.body}</p>
              <button onClick={() => removeIdea(idea.id)} className="shrink-0 text-xs text-text-soft/50 active:text-text-soft">
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <NavDrawer open={drawerOpen} onOpenChange={setDrawerOpen} user={user} active="dashboard" />
    </div>
  );
}
