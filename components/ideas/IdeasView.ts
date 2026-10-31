"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import type { Idea } from "@prisma/client";
import { api } from "@/lib/api-client";
import { timeAgo } from "@/lib/format";
import { NavDrawer } from "@/components/navigation/NavDrawer";

export function IdeasView({
  initialIdeas,
  user,
}: {
  initialIdeas: Idea[];
  user: { penName: string; avatarUrl: string | null };
}) {
  const [ideas, setIdeas] = useState(initialIdeas);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // An idea jotted down from the menu while this page is open shows up here
  // right away.
  useEffect(() => {
    function onAdded(e: Event) {
      const added = (e as CustomEvent<Idea>).detail;
      setIdeas((prev) => (prev.some((i) => i.id === added.id) ? prev : [added, ...prev]));
    }
    window.addEventListener("plotless:idea-added", onAdded);
    return () => window.removeEventListener("plotless:idea-added", onAdded);
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || adding) return;
    setError(null);
    setAdding(true);
    try {
      const { idea } = await api.post<{ idea: Idea }>("/api/ideas", { body });
      setIdeas((prev) => (prev.some((i) => i.id === idea.id) ? prev : [idea, ...prev]));
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    const before = ideas;
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    try {
      await api.delete(`/api/ideas/${id}`);
    } catch (err) {
      setIdeas(before);
      setError(err instanceof Error ? err.message : "Couldn't remove that idea.");
    }
  }

  return (
    <div className="min-h-screen bg-paper pb-16 pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between px-4 py-3">
        <button onClick={() => setDrawerOpen(true)} aria-label="Menu" className="rounded-lg p-2.5 text-text active:bg-active">
          <ChevronLeft size={20} strokeWidth={1.6} />
        </button>
        <span className="text-xs font-bold tracking-[0.16em] text-text">IDEAS</span>
        <div className="w-9" />
      </header>

      <div className="mx-auto max-w-lg px-5 pt-2">
        <form onSubmit={add} className="mb-6">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Jot something down — a line, a character, a what-if…"
            className="w-full resize-none rounded-xl border border-divider bg-transparent px-3 py-2.5 text-sm text-text outline-none placeholder:text-text-soft focus-visible:border-text"
          />
          <button
            type="submit"
            disabled={!draft.trim() || adding}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-strong py-2.5 text-sm font-semibold text-on-strong disabled:opacity-40"
          >
            <Plus size={15} strokeWidth={2} />
            {adding ? "Saving…" : "Add idea"}
          </button>
        </form>

        {error && <p className="mb-3 text-sm text-text-soft">{error}</p>}

        {ideas.length === 0 ? (
          <p className="px-1 text-sm text-text-soft">
            No ideas yet. Anything worth remembering goes here — from any screen, open the menu and jot it down.
          </p>
        ) : (
          <div className="space-y-2">
            {ideas.map((idea) => (
              <div key={idea.id} className="rounded-2xl bg-surface p-4">
                <p className="whitespace-pre-wrap text-sm text-text">{idea.body}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-text-soft">{timeAgo(idea.createdAt)}</span>
                  <button onClick={() => remove(idea.id)} className="text-xs text-text-soft/70 active:text-text">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NavDrawer open={drawerOpen} onOpenChange={setDrawerOpen} user={user} active="ideas" />
    </div>
  );
  }
