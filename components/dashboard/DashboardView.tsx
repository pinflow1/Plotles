"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Lightbulb, Plus } from "lucide-react";
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
  // True when the signed-in user owns the story and this is a writer
  // asking to join it, rather than an invite they received.
  isJoinRequest: boolean;
};

export function DashboardView({
  projects,
  user,
  initialIdeas,
  streak,
  heatmap,
  dailyGoalTotal,
  initialInvitations,
}: {
  projects: ProjectWithChapters[];
  user: { penName: string; avatarUrl: string | null };
  initialIdeas: Idea[];
  streak: number;
  heatmap: HeatmapDay[];
  dailyGoalTotal: number;
  initialInvitations: Invitation[];
}) {
  const router = useRouter();
  const [invitations, setInvitations] = useState(initialInvitations);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState(initialIdeas);

  // An idea jotted down from the menu shows up in the preview right away.
  useEffect(() => {
    function onAdded(e: Event) {
      const added = (e as CustomEvent<Idea>).detail;
      setIdeas((prev) => (prev.some((i) => i.id === added.id) ? prev : [added, ...prev].slice(0, 3)));
    }
    window.addEventListener("plotless:idea-added", onAdded);
    return () => window.removeEventListener("plotless:idea-added", onAdded);
  }, []);

  const mostRecent = projects[0];
  const mostRecentChapter = mostRecent && [...mostRecent.chapters].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const mostRecentTotalWords = mostRecent?.chapters.reduce((sum, c) => sum + c.wordCount, 0) ?? 0;
  const heroPace = mostRecent ? computePace(mostRecentTotalWords, mostRecent.goalWordCount, mostRecent.deadline) : null;

  function newStory() {
    router.push("/projects/new");
  }

  async function respondToInvite(id: string, status: "accepted" | "rejected") {
    setRespondingTo(id);
    setError(null);
    try {
      await api.patch(`/api/collaboration-requests/${id}`, { status });
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
      if (status === "accepted") router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't respond to that invite.");
    } finally {
      setRespondingTo(null);
    }
  }

  return (
    <div className="min-h-screen bg-paper pb-16 pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between px-4 py-3">
        <button onClick={() => setDrawerOpen(true)} aria-label="Menu" className="rounded-lg p-2.5 text-text active:bg-active">
          <ChevronLeft size={20} strokeWidth={1.6} />
        </button>
        <span className="text-xs font-bold tracking-[0.16em] text-text">PLOTLESS</span>
        <button onClick={() => router.push("/ideas")} aria-label="Ideas" className="rounded-lg p-2.5 text-text active:bg-active">
          <Lightbulb size={19} strokeWidth={1.6} />
        </button>
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
                      <span className="font-medium">{inv.initiator.penName}</span>{" "}
                      {inv.isJoinRequest ? "wants to join" : "invited you to collaborate on"}{" "}
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
                    {respondingTo === inv.id ? (inv.isJoinRequest ? "Accepting…" : "Joining…") : "Accept"}
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
          <button onClick={newStory} className="flex items-center gap-1 text-sm text-text">
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

        {/* A glance at the latest ideas — deliberately quiet, below the stories. The Ideas page is where they live. */}
        <div className="mb-2 mt-8 flex items-center justify-between">
          <span className="text-xs uppercase tracking-[0.08em] text-text-soft">Ideas</span>
          <button onClick={() => router.push("/ideas")} className="text-sm text-text-soft active:text-text">
            See all
          </button>
        </div>
        {ideas.length === 0 ? (
          <button onClick={() => router.push("/ideas")} className="w-full px-2 py-2 text-left text-sm text-text-soft/80 active:text-text-soft">
            Nothing here yet. Jot an idea down — it will wait for you.
          </button>
        ) : (
          <div className="space-y-0.5">
            {ideas.map((idea) => (
              <button key={idea.id} onClick={() => router.push("/ideas")} className="block w-full rounded-xl px-2 py-2 text-left active:bg-active">
                <p className="line-clamp-2 text-sm text-text-soft">{idea.body}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <NavDrawer open={drawerOpen} onOpenChange={setDrawerOpen} user={user} active="dashboard" />
    </div>
  );
                                                                                    }
