"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import type { Chapter, Idea, Project } from "@prisma/client";
import { api } from "@/lib/api-client";
import { formatWordCount } from "@/lib/format";
import { computePace } from "@/lib/pace";
import { Avatar } from "@/components/ui/Avatar";
import { NavDrawer } from "@/components/navigation/NavDrawer";
import { StreakHeatmap } from "@/components/dashboard/StreakHeatmap";
import { StoryCard } from "@/components/dashboard/StoryCard";

type ProjectWithChapters = Project & { chapters: Chapter[]; role: "owner" | "edit" | "view"; collaboratorCount: number };
type HeatmapDay = { date: string; words: number };
type Invitation = {
  id: string;
  role: "edit" | "view";
  message: string | null;
  createdAt: Date;
  project: { id: string; title: string };
  initiator: { id: string; penName: string; avatarUrl: string | null };
};

export function DashboardView({
  projects,
  initialIdeas,
  user,
  streak,
  heatmap,
  dailyGoalTotal,
  initialInvitations,
}: {
  projects: ProjectWithChapters[];
  initialIdeas: Idea[];
  user: { penName: string; avatarUrl: string | null };
  streak: number;
  heatmap: HeatmapDay[];
  dailyGoalTotal: number;
  initialInvitations: Invitation[];
}) {
  const router = useRouter();
  const [ideas, setIdeas] = useState(initialIdeas);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newIdea, setNewIdea] = useState("");
  const [creating, setCreating] = useState(false);
  const [addingIdea, setAddingIdea] = useState(false);
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

  async function respondToInvite(id: string, status: "accepted" | "rejected") {
    setRespondingTo(id);
    setError(null);
    try {
      await api.patch(`/api/collaboration-requests/${id}`, { status });
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
      // Accepting grants access to a project this list doesn't have yet —
      // pull the fresh server data rather than hand-assembling it here.
      if (status === "accepted") router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't respond to that invite.");
    } finally {
      setRespondingTo(null);
    }
  }

  async function addIdea(e: React.FormEvent) {
    e.preventDefault();
    if (!newIdea.trim() || addingIdea) return;
    setError(null);
    setAddingIdea(true);
    try {
      const { idea } = await api.post<{ idea: Idea }>("/api/ideas", { body: newIdea.trim() });
      setIdeas((prev) => [idea, ...prev]);
      setNewIdea("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that. Please try again.");
    } finally {
      setAddingIdea(false);
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

        {invitations.length > 0 && (
          <section className="mt-2 space-y-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="rounded-2xl bg-surface p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={inv.initiator.penName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text">
                      <span className="font-medium">{inv.initiator.penName}</span> invited you to collaborate on{" "}
                      <span className="font-medium">{inv.project.title}</span>
                    </p>
                    {inv.message && <p className="mt-1 text-sm text-text-soft">“{inv.message}”</p>}
                    <p className="mt-1 text-xs capitalize text-text-soft">{inv.role} access</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => respondToInvite(inv.id, "rejected")}
                    disabled={respondingTo === inv.id}
                    className="flex-1 rounded-lg bg-active py-1.5 text-xs font-medium text-text disabled:opacity-60"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => respondToInvite(inv.id, "accepted")}
                    disabled={respondingTo === inv.id}
                    className="flex-1 rounded-lg bg-strong py-1.5 text-xs font-semibold text-on-strong disabled:opacity-60"
                  >
                    {respondingTo === inv.id ? "Joining…" : "Accept"}
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        <StreakHeatmap streak={streak} heatmap={heatmap} dailyGoalTotal={dailyGoalTotal} />

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
        <form onSubmit={addIdea} className="mb-2 flex gap-2">
          <input
            value={newIdea}
            onChange={(e) => setNewIdea(e.target.value)}
            placeholder="Jot something down…"
            className="w-full flex-1 rounded-xl border border-divider bg-transparent px-3 py-2 text-sm text-text outline-none placeholder:text-text-soft focus-visible:border-text"
          />
          <button
            type="submit"
            disabled={!newIdea.trim() || addingIdea}
            aria-label="Add idea"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-strong text-on-strong disabled:opacity-40"
          >
            <Plus size={16} strokeWidth={2} />
          </button>
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
