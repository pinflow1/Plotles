"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import type { Chapter, Idea, Project } from "@prisma/client";
import { api } from "@/lib/api-client";
import { formatWordCount } from "@/lib/format";
import { computePace } from "@/lib/pace";
import { NavDrawer } from "@/components/navigation/NavDrawer";
import { StreakHeatmap } from "@/components/dashboard/StreakHeatmap";
import { StoryCard } from "@/components/dashboard/StoryCard";

type ProjectWithChapters = Project & { chapters: Chapter[]; role: "owner" | "edit" | "view"; collaboratorCount: number };
type HeatmapDay = { date: string; words: number };

export function DashboardView({
  projects,
  initialIdeas,
  user,
  streak,
  heatmap,
}: {
  projects: ProjectWithChapters[];
  initialIdeas: Idea[];
  user: { penName: string; avatarUrl: string | null };
  streak: number;
  heatmap: HeatmapDay[];
}) {
  const router = useRouter();
  const [ideas, setIdeas] = useState(initialIdeas);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newIdea, setNewIdea] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mostRecent = projects[0];
  const mostRecentChapter = mostRecent && [...mostRecent.chapters].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const mostRecentTotalWords = mostRecent?.chapters.reduce((sum, c) => sum + c.wordCount, 0) ?? 0;
  const heroPace = mostRecent ? computePace(mostRecentTotalWords, mostRecent.goalWordCount, mostRecent.deadline) : null;

  async function newStory() {
    setCreating(true);
    setError(null);
    try {
      const { project } = await api.post<{ project: ProjectWithChapters }>("/api/projects", { title: "Untitled Story" });
      router.push(`/editor/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start a new story. Please try again.");
      setCreating(false);
    }
  }

  async function addIdea(e: React.FormEvent) {
    e.preventDefault();
    if (!newIdea.trim()) return;
    setError(null);
    try {
      const { idea } = await api.post<{ idea: Idea }>("/api/ideas", { body: newIdea.trim() });
      setIdeas((prev) => [idea, ...prev]);
      setNewIdea("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that. Please try again.");
    }
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
        {error && <p className="mt-2 text-sm text-text-soft">{error}</p>}

        <StreakHeatmap streak={streak} heatmap={heatmap} />

        {mostRecent && mostRecentChapter && (
          <section className="mt-4 rounded-2xl bg-surface p-5">
            <div className="text-xs uppercase tracking-[0.08em] text-text-soft">Continue Writing</div>
            <div className="mt-2 font-serif text-xl text-text">{mostRecent.title}</div>
            <div className="mt-0.5 text-sm text-text-soft">
              {mostRecentChapter.title} · {formatWordCount(mostRecentTotalWords)}
            </div>
            {heroPace && (
              <div className="mt-3">
                <div className="h-1 overflow-hidden rounded-full bg-active">
                  <div className="h-full rounded-full bg-strong" style={{ width: `${heroPace.progress * 100}%` }} />
                </div>
                <div className="mt-1 text-xs text-text-soft">
                  {heroPace.wordsRemaining === 0
                    ? "Goal reached"
                    : heroPace.dailyTarget !== null
                      ? heroPace.overdue
                        ? `${heroPace.wordsRemaining.toLocaleString()} words left · past deadline`
                        : `${heroPace.dailyTarget.toLocaleString()} words/day to finish on time`
                      : `${heroPace.wordsRemaining.toLocaleString()} words to go`}
                </div>
              </div>
            )}
            <button
              onClick={() => router.push(`/editor/${mostRecent.id}`)}
              className="mt-4 w-full rounded-xl bg-strong py-3 text-sm font-semibold text-on-strong transition-opacity active:opacity-85"
            >
              Continue writing
            </button>
          </section>
        )}

        <div className="mb-3 mt-8 flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.08em] text-text-soft">Your Stories</span>
          <button onClick={newStory} disabled={creating} className="flex items-center gap-1 text-sm text-text disabled:opacity-50">
            <Plus size={14} strokeWidth={2} />
            New Story
          </button>
        </div>

        {projects.length === 0 ? (
          <p className="px-2 py-4 text-sm text-text-soft">No stories yet — start your first one above.</p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-5">
            {projects.map((p) => (
              <StoryCard key={p.id} project={p} onClick={() => router.push(`/projects/${p.id}`)} />
            ))}
          </div>
        )}

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
